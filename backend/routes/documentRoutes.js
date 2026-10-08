/**
 * Medical Document Routes
 */
const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkPatientAccess } = require('../middleware/dataIsolation');
const { uploadCertificate } = require('../middleware/upload');

router.use(authenticate);

// Upload medical document (Doctor or Patient)
router.post(
  '/',
  uploadCertificate.single('documentFile'),
  documentController.uploadDocument
);

// Get all documents for a patient (Strict data isolation check on patientId)
router.get(
  '/patient/:patientId',
  checkPatientAccess,
  documentController.getPatientDocuments
);

// Securely download/view document
router.get(
  '/:id/download',
  documentController.downloadDocument
);

// Delete medical document / report (Patient own document or Admin)
router.delete(
  '/:id',
  documentController.deleteDocument
);

// Analyze and explain medical report with Claude AI & MATLAB Deep Learning
router.post(
  '/:id/ai-explain',
  documentController.explainDocument
);

module.exports = router;
