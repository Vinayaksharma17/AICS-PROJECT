const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // Name Fields
  firstName: { type: String, required: [true, 'Please add first name'], trim: true },
  fatherName: { type: String, trim: true },
  lastName:   { type: String, trim: true },

  // Required Fields
  address:       { type: String, required: [true, 'Please add address'] },
  qualification: { type: String, required: [true, 'Please add qualification'] },
  phoneNumber:   { type: String, required: [true, 'Please add phone number'], match: [/^[0-9]{10}$/, 'Please add a valid 10-digit phone number'] },
  email:         { type: String, trim: true, lowercase: true, match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'] },

  // Specific Document Uploads (Issue #2)
  studentPhoto:     { fileName: String, fileUrl: String, uploadedAt: Date },
  qualificationDoc: { fileName: String, fileUrl: String, uploadedAt: Date },
  aadharCard:       { fileName: String, fileUrl: String, uploadedAt: Date },

  // Legacy documents array (kept for backward compatibility)
  documents: [{ fileName: String, fileUrl: String, uploadedAt: { type: Date, default: Date.now } }],

  profileComplete: { type: Boolean, default: false },

  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: [true, 'Please select a course'] },

  // Fee Structure with Discount
  totalFees: { type: Number, required: [true, 'Please add total fees'], min: 0 },
  discount:  { couponCode: String, percentage: Number, appliedAmount: Number },
  finalFees: { type: Number, required: true, min: 0 },

  // Installments
  installments: [{
    installmentNumber: Number,
    amount:   Number,
    dueDate:  Date,
    paidDate: Date,
    status:   { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' }
  }],

  paidFees:    { type: Number, default: 0, min: 0 },
  pendingFees: { type: Number, required: true },

  // Payment History
  payments: [{
    amount:        { type: Number, required: true },
    date:          { type: Date, default: Date.now },
    receivedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'], default: 'cash' },
    remarks:       String,
    installmentId: mongoose.Schema.Types.ObjectId
  }],

  // Course Duration
  enrollmentDate:  { type: Date, default: Date.now },
  courseDuration:  { type: Number, required: true, min: 1 }, // months
  courseEndDate:   Date,
  courseCompleted: { type: Boolean, default: false },

  // Certificate
  certificateEligible:   { type: Boolean, default: false },
  certificateIssued:     { type: Boolean, default: false },
  certificateIssuedDate: Date,
  certificateNumber:     String, // Format: YYAICES001
  grade:                 { type: String, enum: ['A+','A','B+','B','C'], default: 'A' }, // Certificate grade

  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // Invoice
  invoiceGenerated: { type: Boolean, default: false },
  invoiceNumber:    String,
  invoiceUrl:       String,

  addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.fatherName} ${this.lastName}`;
});

studentSchema.pre('save', function(next) {
  // Calculate pending fees
  this.pendingFees = Math.max(0, this.finalFees - this.paidFees); // clamp: never negative

  // Profile complete if all 3 specific documents are uploaded OR (legacy) 2+ documents in old array
  const hasPhoto  = !!(this.studentPhoto && this.studentPhoto.fileUrl);
  const hasQual   = !!(this.qualificationDoc && this.qualificationDoc.fileUrl);
  const hasAadhar = !!(this.aadharCard && this.aadharCard.fileUrl);
  const hasNewDocs = hasPhoto && hasQual && hasAadhar;
  const hasLegacyDocs = this.documents && this.documents.length >= 2;
  this.profileComplete = hasNewDocs || hasLegacyDocs;

  // Update overdue installments
  if (this.installments && this.installments.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.installments.forEach(inst => {
      if (inst.status === 'pending' && inst.dueDate) {
        const due = new Date(inst.dueDate);
        due.setHours(0, 0, 0, 0);
        if (today > due) inst.status = 'overdue';
      }
    });
  }

  // Calculate course end date
  if (this.enrollmentDate && this.courseDuration) {
    const end = new Date(this.enrollmentDate);
    end.setMonth(end.getMonth() + this.courseDuration);
    this.courseEndDate = end;
  }

  // Certificate eligibility: full payment + all 3 documents uploaded
  this.certificateEligible = (this.pendingFees === 0 && this.profileComplete);

  next();
});

module.exports = mongoose.model('Student', studentSchema);
