const express = require('express');
const router = express.Router();
const {
  addStudent, getAllStudents, getStudent,
  updateStudent, deleteStudent, addPayment, uploadDocument
} = require('../controllers/studentController');
const { protect, adminOrStaff, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadStudentDocs } = require('../middleware/upload');

router.use(protect);

router.route('/')
  .post(adminOrStaff, uploadStudentDocs, addStudent)
  .get(adminOrStaff, getAllStudents);

router.route('/:id')
  .get(adminOrStaff, getStudent)
  .put(adminOrStaff, uploadStudentDocs, updateStudent)
  .delete(adminOnly, deleteStudent);

router.post('/:id/payment', adminOrStaff, addPayment);
// Support both named-fields upload and single file upload
router.post('/:id/upload-document', adminOrStaff, uploadStudentDocs, uploadDocument);

module.exports = router;
