const express = require('express');
const router = express.Router();
const {
  addStudent, getAllStudents, getStudent,
  updateStudent, deleteStudent, addPayment, uploadDocument, downloadInvoice
} = require('../controllers/studentController');
const { protect, adminOrStaff, adminOnly } = require('../middleware/auth');
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
router.get('/:id/invoice', adminOrStaff, downloadInvoice);

module.exports = router;
