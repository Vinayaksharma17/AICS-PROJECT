const Discount = require('../models/Discount');

exports.addDiscount = async (req, res) => {
  try {
    // Remove maxUsage from payload (Issue #5)
    const { maxUsage, ...rest } = req.body;
    const discount = await Discount.create({ ...rest, createdBy: req.user._id });
    res.status(201).json(discount);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Coupon code already exists' });
    res.status(500).json({ message: error.message });
  }
};

exports.getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().populate('createdBy', 'name').sort('-createdAt');
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDiscount = async (req, res) => {
  try {
    const { maxUsage, ...rest } = req.body;
    const discount = await Discount.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });
    if (!discount) return res.status(404).json({ message: 'Discount not found' });
    res.json(discount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount not found' });
    await discount.deleteOne();
    res.json({ message: 'Discount deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, courseFees } = req.body;
    if (!couponCode) return res.status(400).json({ message: 'Coupon code is required' });
    const discount = await Discount.findOne({ couponCode: couponCode.trim().toUpperCase() });
    if (!discount) return res.status(404).json({ message: 'Coupon code not found' });
    if (!discount.isValid()) {
      // Detailed error for debugging
      const now = new Date();
      if (!discount.isActive) return res.status(400).json({ message: 'This coupon is inactive' });
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fromDate = new Date(new Date(discount.validFrom).getFullYear(), new Date(discount.validFrom).getMonth(), new Date(discount.validFrom).getDate());
      const tillDate = new Date(new Date(discount.validTill).getFullYear(), new Date(discount.validTill).getMonth(), new Date(discount.validTill).getDate());
      if (todayDate < fromDate) return res.status(400).json({ message: `Coupon is not valid yet. Valid from ${new Date(discount.validFrom).toLocaleDateString('en-IN')}` });
      if (todayDate > tillDate) return res.status(400).json({ message: `Coupon has expired on ${new Date(discount.validTill).toLocaleDateString('en-IN')}` });
      return res.status(400).json({ message: 'Invalid or expired coupon code' });
    }
    const result = discount.applyDiscount(Number(courseFees));
    res.json({ valid: true, couponCode: discount.couponCode, description: discount.description, amount: discount.amount, ...result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all active discounts for dropdown (Issue #4)
exports.getActiveDiscounts = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const discounts = await Discount.find({
      isActive: true,
      validFrom: { $lte: endOfDay },
      validTill: { $gte: startOfDay }
    }).sort('-createdAt');
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
