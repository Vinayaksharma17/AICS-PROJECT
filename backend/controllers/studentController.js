const fs = require('fs');
const Student = require('../models/Student');
const Counter = require('../models/Counter');
const { generateInvoice } = require('../utils/invoiceGenerator');

// Helper: build document object from uploaded file
const buildDocObj = (file) => file ? {
  fileName: file.originalname,
  fileUrl: `/uploads/documents/${file.filename}`,
  uploadedAt: new Date()
} : undefined;

// Helper: delete any files Multer already wrote to disk when the request fails
const cleanupUploadedFiles = (req) => {
  if (!req.files) return;
  Object.values(req.files).forEach(fileArr =>
    fileArr.forEach(f => fs.unlink(f.path, () => {}))
  );
};

exports.addStudent = async (req, res) => {
  try {
    const {
      firstName, fatherName, lastName, phoneNumber, email,
      address, qualification, course, totalFees, paidFees,
      initialPaymentMethod, couponCode, courseDuration, installments
    } = req.body;

    const existing = await Student.findOne({ phoneNumber });
    if (existing) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ message: 'A student with this phone number already exists' });
    }

    let discountData = null;
    let finalFees = Number(totalFees);

    if (couponCode) {
      const Discount = require('../models/Discount');
      const coupon = await Discount.findOne({ couponCode: couponCode.toUpperCase() });
      if (!coupon || !coupon.isValid()) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
      const applied = coupon.applyDiscount(Number(totalFees));
      finalFees = applied.finalFees;
      discountData = { couponCode: coupon.couponCode, percentage: coupon.percentage, appliedAmount: applied.discountAmount };
      await coupon.incrementUsage();
    }

    // Clamp initialPayment to finalFees (never exceed discounted total)
    const initialPayment = Math.min(Number(paidFees) || 0, finalFees);

    // Build installments (discount does not restrict installments)
    let installmentData = [];
    if (installments && Array.isArray(installments)) {
      installmentData = installments.map((inst, i) => {
        const obj = {
          installmentNumber: i + 1,
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
          status: 'pending'
        };
        if (i === 0 && initialPayment > 0 && initialPayment >= inst.amount) {
          obj.status = 'paid';
          obj.paidDate = new Date();
        }
        return obj;
      });
    }

    // Handle uploaded documents (Issue #2)
    const files = req.files || {};
    const studentPhotoFile = files.studentPhoto && files.studentPhoto[0];
    const qualificationDocFile = files.qualificationDoc && files.qualificationDoc[0];
    const aadharCardFile = files.aadharCard && files.aadharCard[0];

    const student = await Student.create({
      firstName, fatherName, lastName,
      phoneNumber, email, address, qualification,
      course, totalFees: Number(totalFees),
      discount: discountData,
      finalFees,
      paidFees: initialPayment,
      pendingFees: Math.max(0, finalFees - initialPayment),
      courseDuration: Number(courseDuration) || 3,
      installments: installmentData,
      enrollmentDate: new Date(),
      status: 'active',
      addedBy: req.user._id,
      payments: [],
      studentPhoto:     buildDocObj(studentPhotoFile),
      qualificationDoc: buildDocObj(qualificationDocFile),
      aadharCard:       buildDocObj(aadharCardFile)
    });

    // Add initial payment record
    if (initialPayment > 0) {
      const hasInstallments = installmentData.length > 0;
      student.payments.push({
        amount: initialPayment,
        paymentMethod: initialPaymentMethod || 'cash',
        remarks: hasInstallments ? 'First installment payment' : 'Initial payment',
        receivedBy: req.user._id,
        installmentId: (hasInstallments && initialPayment >= installmentData[0].amount) ? student.installments[0]._id : undefined
      });
      await student.save();
    }

    // Increment course enrolledCount
    const Course = require('../models/Course');
    await Course.findByIdAndUpdate(course, { $inc: { enrolledCount: 1 } });

    const populated = await Student.findById(student._id)
      .populate('course', 'name duration')
      .populate('addedBy', 'name');

    // Generate invoice only if a payment was made
    let invoiceResult = null;
    if (populated.paidFees > 0) {
      const invoiceNumber = await Counter.getNextInvoiceNumber();
      const invoice = await generateInvoice(populated, invoiceNumber);
      populated.invoiceGenerated = true;
      populated.invoiceNumber = invoiceNumber;
      populated.invoiceUrl = invoice.filePath;
      await populated.save();
      invoiceResult = { url: invoice.filePath, fileName: invoice.fileName };
    }

    res.status(201).json({
      message: 'Student added successfully',
      student: populated,
      ...(invoiceResult && { invoice: invoiceResult })
    });
  } catch (error) {
    cleanupUploadedFiles(req);
    res.status(500).json({ message: error.message });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.course) filter.course = req.query.course;
    const students = await Student.find(filter)
      .populate('course', 'name duration fees')
      .populate('addedBy', 'name')
      .sort('-createdAt');
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('course', 'name duration fees')
      .populate('addedBy', 'name')
      .populate('payments.receivedBy', 'name');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const fields = ['firstName','fatherName','lastName','phoneNumber','email','address','qualification','course','totalFees','status','courseDuration','courseCompleted'];
    fields.forEach(f => { if (req.body[f] !== undefined) student[f] = req.body[f]; });

    if (req.files) {
      const files = req.files;
      if (files.studentPhoto && files.studentPhoto[0]) {
        student.studentPhoto = buildDocObj(files.studentPhoto[0]);
      }
      if (files.qualificationDoc && files.qualificationDoc[0]) {
        student.qualificationDoc = buildDocObj(files.qualificationDoc[0]);
      }
      if (files.aadharCard && files.aadharCard[0]) {
        student.aadharCard = buildDocObj(files.aadharCard[0]);
      }
    }

    const updated = await student.save();
    const populated = await Student.findById(updated._id)
      .populate('course', 'name duration fees')
      .populate('addedBy', 'name');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const Course = require('../models/Course');
    await Course.findByIdAndUpdate(student.course, { $inc: { enrolledCount: -1 } });
    await student.deleteOne();
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const { amount, paymentMethod, remarks, installmentId } = req.body;
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    if (student.paidFees + Number(amount) > student.finalFees) return res.status(400).json({ message: 'Payment exceeds total fees' });

    let targetInstallmentId = installmentId;
    if (!targetInstallmentId && student.installments.length > 0) {
      const nextPending = student.installments.find(i => i.status === 'pending' || i.status === 'overdue');
      if (nextPending) targetInstallmentId = nextPending._id;
    }

    student.payments.push({ amount: Number(amount), paymentMethod: paymentMethod || 'cash', remarks, receivedBy: req.user._id, installmentId: targetInstallmentId });
    student.paidFees += Number(amount);

    if (targetInstallmentId) {
      const inst = student.installments.id(targetInstallmentId);
      if (inst) { inst.status = 'paid'; inst.paidDate = new Date(); }
    }

    await student.save();
    const updated = await Student.findById(student._id)
      .populate('course', 'name')
      .populate('payments.receivedBy', 'name');

    const invoiceNumber = updated.invoiceNumber || await Counter.getNextInvoiceNumber();
    const invoice = await generateInvoice(updated, invoiceNumber);
    updated.invoiceNumber = invoiceNumber;
    updated.invoiceUrl = invoice.filePath;
    await updated.save();

    res.json({ student: updated, invoice: { url: invoice.filePath, fileName: invoice.fileName } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload specific document for student (Issue #2)
exports.uploadDocument = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const { docType } = req.body; // 'studentPhoto', 'qualificationDoc', 'aadharCard'
    const allowedTypes = ['studentPhoto', 'qualificationDoc', 'aadharCard'];

    // Handle named field upload (new way)
    if (req.files && Object.keys(req.files).length > 0) {
      for (const fieldName of allowedTypes) {
        if (req.files[fieldName] && req.files[fieldName][0]) {
          const file = req.files[fieldName][0];
          student[fieldName] = {
            fileName: file.originalname,
            fileUrl: `/uploads/documents/${file.filename}`,
            uploadedAt: new Date()
          };
        }
      }
    } else if (req.file) {
      // Legacy single file upload
      const type = allowedTypes.includes(docType) ? docType : 'qualificationDoc';
      student[type] = {
        fileName: req.file.originalname,
        fileUrl: `/uploads/documents/${req.file.filename}`,
        uploadedAt: new Date()
      };
    } else {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    await student.save();
    const updated = await Student.findById(student._id).populate('course', 'name');
    res.json({ message: 'Document uploaded successfully', student: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
