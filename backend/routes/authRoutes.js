const express = require('express');
const router = express.Router();
const { login, getProfile, updateProfile, getSetupStatus, setupAdmin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.get('/setup-status', getSetupStatus);
router.post('/setup', setupAdmin);
router.post('/login', login);
router.route('/profile')
  .get(protect, getProfile)
  .put(protect, updateProfile);

module.exports = router;
