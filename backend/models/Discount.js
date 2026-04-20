const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  couponCode:  { type: String, required: [true, 'Please add coupon code'], unique: true, uppercase: true, trim: true },
  description: { type: String, required: [true, 'Please add description'] },
  amount:      { type: Number, required: [true, 'Please add discount amount'], min: [0, 'Cannot be negative'] },

  // Validity
  validFrom: { type: Date, required: [true, 'Please add valid from date'] },
  validTill: { type: Date, required: [true, 'Please add valid till date'] },

  // Status
  isActive:   { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },

  // Applicable Courses
  applicableCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  applicableToAll:   { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Check if coupon is currently valid (Issue #3 fix: timezone-safe date comparison)
discountSchema.methods.isValid = function() {
  if (!this.isActive) return false;

  const today = new Date();
  // Compare date-only to avoid timezone issues
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const from = new Date(this.validFrom);
  const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  const till = new Date(this.validTill);
  const tillDate = new Date(till.getFullYear(), till.getMonth(), till.getDate());

  if (todayDate < fromDate || todayDate > tillDate) return false;
  return true;
};

// Apply discount to fees
discountSchema.methods.applyDiscount = function(courseFees) {
  const discountAmount = Math.min(this.amount, courseFees); // cannot exceed total fees
  return {
    originalFees:   courseFees,
    discountAmount: discountAmount,
    finalFees:      Math.max(0, courseFees - discountAmount)
  };
};

// Increment usage
discountSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

module.exports = mongoose.model('Discount', discountSchema);
