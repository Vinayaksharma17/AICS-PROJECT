const fs   = require('fs');
const path = require('path');
const Student = require('../models/Student');
const Enquiry = require('../models/Enquiry');
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
      firstName, fatherName, lastName, certificateName, phoneNumber, aadhaarNumber, email,
      address, qualification, course, totalFees, paidFees,
      initialPaymentMethod, couponCode, courseDuration, admissionDate, installments,
      enquiryId
    } = req.body;

    // Check Aadhaar first — duplicate gets upgrade prompt (takes priority over phone)
    const existingAadhaar = await Student.findOne({ aadhaarNumber: req.body.aadhaarNumber }).populate('course', 'name duration fees');
    if (existingAadhaar) {
      cleanupUploadedFiles(req);
      return res.status(409).json({
        code: 'DUPLICATE_AADHAAR',
        message: 'A student with this aadhaar number already exists',
        existingStudent: {
          _id: existingAadhaar._id,
          firstName: existingAadhaar.firstName,
          fatherName: existingAadhaar.fatherName,
          lastName: existingAadhaar.lastName,
          phoneNumber: existingAadhaar.phoneNumber,
          course: existingAadhaar.course,
          courseDuration: existingAadhaar.courseDuration,
          totalFees: existingAadhaar.totalFees,
          finalFees: existingAadhaar.finalFees,
          paidFees: existingAadhaar.paidFees,
          enrollmentDate: existingAadhaar.enrollmentDate,
          certificateNumber: existingAadhaar.certificateNumber,
          certificateIssued: existingAadhaar.certificateIssued
        }
      });
    }

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
      discountData = { couponCode: coupon.couponCode, amount: coupon.amount, appliedAmount: applied.discountAmount };
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
      firstName, fatherName, lastName, certificateName,
      phoneNumber, aadhaarNumber, email, address, qualification,
      course, totalFees: Number(totalFees),
      discount: discountData,
      finalFees,
      paidFees: initialPayment,
      pendingFees: Math.max(0, finalFees - initialPayment),
      courseDuration: Number(courseDuration) || 3,
      installments: installmentData,
      enrollmentDate: admissionDate ? new Date(admissionDate) : new Date(),
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

    // If created from an enquiry, mark it as converted
    if (enquiryId) {
      await Enquiry.findByIdAndUpdate(enquiryId, {
        status: 'converted',
        convertedToStudent: populated._id,
        convertedAt: new Date()
      });
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

    const fields = ['firstName','fatherName','lastName','certificateName','phoneNumber','aadhaarNumber','email','address','qualification','course','totalFees','status','courseDuration','courseCompleted','grade','certificateNumber'];
    fields.forEach(f => { if (req.body[f] !== undefined) student[f] = req.body[f]; });

    if (req.body.admissionDate) {
      student.enrollmentDate = new Date(req.body.admissionDate);
    }
    if (req.body.courseEndDate) {
      student.courseEndDate = new Date(req.body.courseEndDate);
    }
    if (req.body.certificateIssuedDate) {
      student.certificateIssuedDate = new Date(req.body.certificateIssuedDate);
    }

    // Handle coupon code / discount
    if (req.body.couponCode) {
      const Coupon = require('../models/Discount');
      const coupon = await Coupon.findOne({ couponCode: req.body.couponCode, isActive: true });
      if (coupon) {
        const totalFees = Number(req.body.totalFees) || student.totalFees;
        const discountAmount = Math.min(coupon.amount, totalFees);
        student.discount = {
          couponCode: coupon.couponCode,
          amount: coupon.amount,
          appliedAmount: discountAmount
        };
        student.finalFees = totalFees - discountAmount;
      } else {
        student.discount = null;
        student.finalFees = Number(req.body.totalFees) || student.totalFees;
      }
    } else if (req.body.totalFees && !req.body.couponCode) {
      // If no coupon code but totalFees changed, recalculate finalFees
      student.finalFees = Number(req.body.totalFees);
      student.discount = null;
    }

    // Handle payment fields (initialPayment, initialPaymentMethod, installments)
    // Note: We ADD to existing paidFees, not replace it (for backward compatibility)
    if (req.body.initialPayment !== undefined) {
      const newPayment = Number(req.body.initialPayment);
      // Only add if the new payment is more than already paid (to handle additional payments)
      if (newPayment > student.paidFees) {
        student.paidFees = newPayment;
      }
    }
    
    if (req.body.initialPaymentMethod && req.body.initialPayment !== undefined) {
      // Only add payment record if this is a new payment (not just editing existing)
      const existingInitialPayment = student.payments.find(p => p.remarks === 'Initial payment on enrollment');
      if (!existingInitialPayment && Number(req.body.initialPayment) > 0) {
        student.payments.push({
          amount: Number(req.body.initialPayment),
          date: student.enrollmentDate || new Date(),
          paymentMethod: req.body.initialPaymentMethod,
          remarks: 'Initial payment on enrollment'
        });
      }
    }

    if (req.body.installments) {
      try {
        const newInstallments = JSON.parse(req.body.installments);
        // Only update installments if they're different
        if (JSON.stringify(student.installments) !== JSON.stringify(newInstallments)) {
          student.installments = newInstallments;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Mark as edited
    student.edited = true;

    // Clear old invoice so it gets regenerated with updated data
    student.invoiceUrl = undefined;
    student.invoiceNumber = undefined;
    student.invoiceGenerated = false;

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

    const paymentAmount = Number(amount);

    let targetInstallmentId = installmentId;
    if (!targetInstallmentId && student.installments.length > 0) {
      const nextPending = student.installments.find(i => i.status === 'pending' || i.status === 'overdue');
      if (nextPending) targetInstallmentId = nextPending._id;
    }

    // Only mark installment as paid if the payment covers its full amount
    let markInstallmentAsPaid = false;
    if (targetInstallmentId) {
      const inst = student.installments.id(targetInstallmentId);
      if (inst && paymentAmount >= inst.amount) {
        markInstallmentAsPaid = true;
      } else if (inst) {
        // Payment is less than installment amount — don't link to installment
        targetInstallmentId = undefined;
      }
    }

    student.payments.push({ amount: paymentAmount, paymentMethod: paymentMethod || 'cash', remarks, receivedBy: req.user._id, installmentId: targetInstallmentId });
    student.paidFees += paymentAmount;

    if (markInstallmentAsPaid && targetInstallmentId) {
      const inst = student.installments.id(targetInstallmentId);
      if (inst) { inst.status = 'paid'; inst.paidDate = new Date(); }
    }

    // Clear old invoice so it gets regenerated with fresh data
    student.invoiceUrl = undefined;
    student.invoiceNumber = undefined;
    student.invoiceGenerated = false;

    await student.save();
    const updated = await Student.findById(student._id)
      .populate('course', 'name')
      .populate('payments.receivedBy', 'name');

    const invoiceNumber = updated.invoiceNumber || await Counter.getNextInvoiceNumber();
    const invoice = await generateInvoice(updated, invoiceNumber);
    updated.invoiceNumber = invoiceNumber;
    updated.invoiceUrl = invoice.filePath;
    updated.invoiceGenerated = true;
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

// ── GET /students/:id/invoice ──────────────────────────────────────────────
// Serves the stored invoice PDF for a student.
// If the file no longer exists on disk (e.g. after a redeploy), it is
// regenerated on the fly so the download never fails.
exports.downloadInvoice = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('course', 'name duration')
      .populate('payments.receivedBy', 'name');

    if (!student) return res.status(404).json({ message: 'Student not found' });

    let absPath = null;

    // 1. Try to use the already-generated invoice stored on disk
    if (student.invoiceUrl) {
      const candidate = path.join(__dirname, '../../', student.invoiceUrl.replace(/^\//, ''));
      if (fs.existsSync(candidate)) absPath = candidate;
    }

    // 2. If the file is missing, regenerate it so the download always works
    if (!absPath) {
      const invoiceNumber = student.invoiceNumber || await Counter.getNextInvoiceNumber();
      const invoice = await generateInvoice(student, invoiceNumber);
      student.invoiceNumber    = invoiceNumber;
      student.invoiceUrl       = invoice.filePath;
      student.invoiceGenerated = true;
      await student.save();
      absPath = path.join(__dirname, '../../', invoice.filePath.replace(/^\//, ''));
    }

    const fileName = `Invoice_${student.firstName}_${student.lastName}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(absPath).pipe(res);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /students/:id/upgrade ───────────────────────────────────────────
exports.upgradeCourse = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const { newCourse, newDuration, newFees, paidFees, paymentMethod, couponCode, admissionDate, installments } = req.body;

    if (!newCourse || !newDuration || !newFees) {
      return res.status(400).json({ message: 'New course, duration, and fees are required' });
    }

    const upgradeEntry = {
      previousCourse: student.course,
      previousDuration: student.courseDuration,
      previousFees: student.finalFees,
      newCourse,
      newDuration: Number(newDuration),
      newFees: Number(newFees),
      upgradedAt: new Date(),
      upgradedBy: req.user._id
    };

    const Course = require('../models/Course');
    await Course.findByIdAndUpdate(student.course, { $inc: { enrolledCount: -1 } });
    await Course.findByIdAndUpdate(newCourse, { $inc: { enrolledCount: 1 } });

    const newTotalFees = Number(newFees);

    // Apply discount if coupon code provided
    let discountData = null;
    let finalFees = newTotalFees;
    if (couponCode) {
      const Discount = require('../models/Discount');
      const coupon = await Discount.findOne({ couponCode: couponCode.toUpperCase() });
      if (!coupon || !coupon.isValid()) {
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
      const applied = coupon.applyDiscount(newTotalFees);
      finalFees = applied.finalFees;
      discountData = { couponCode: coupon.couponCode, amount: coupon.amount, appliedAmount: applied.discountAmount };
      await coupon.incrementUsage();
    }

    const initialPayment = Math.min(Number(paidFees) || 0, finalFees);

    // Build installments
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

    // Update enrollment date if provided
    if (admissionDate) {
      student.enrollmentDate = new Date(admissionDate);
    }

    student.courseUpgrades.push(upgradeEntry);
    student.course = newCourse;
    student.courseDuration = Number(newDuration);
    student.totalFees = newTotalFees;
    student.discount = discountData;
    student.finalFees = finalFees;
    student.paidFees = initialPayment;
    student.pendingFees = Math.max(0, finalFees - initialPayment);
    student.installments = installmentData;
    student.payments = [];

    student.certificateIssued = false;
    student.certificateIssuedDate = undefined;
    student.certificateEligible = false;

    // Recalculate course end date from enrollmentDate
    const end = new Date(student.enrollmentDate);
    end.setMonth(end.getMonth() + Number(newDuration));
    student.courseEndDate = end;

    if (initialPayment > 0) {
      student.payments.push({
        amount: initialPayment,
        paymentMethod: paymentMethod || 'cash',
        remarks: 'Upgrade initial payment',
        receivedBy: req.user._id
      });
    }

    await student.save();

    const populated = await Student.findById(student._id)
      .populate('course', 'name duration fees')
      .populate('addedBy', 'name')
      .populate('courseUpgrades.previousCourse', 'name')
      .populate('courseUpgrades.newCourse', 'name');

    res.json({ message: 'Course upgraded successfully', student: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};