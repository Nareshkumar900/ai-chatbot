/**
 * Patient Routes (Strict Data Isolation Protected)
 */
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticate, authorize, checkDoctorVerified } = require('../middleware/auth');
const { checkPatientAccess } = require('../middleware/dataIsolation');
const { uploadCertificate } = require('../middleware/upload');

// All patient endpoints require authentication
router.use(authenticate);

// 1. Register new patient (Authenticated & Verified Doctor only)
router.post(
  '/',
  authorize('doctor'),
  checkDoctorVerified,
  uploadCertificate.single('certificateFile'),
  patientController.registerPatient
);

// 2. Get list of patients (Doctor sees registered + approved only; Admin sees all)
router.get('/', patientController.getPatients);

// 3. Get single patient details (Enforces strict data isolation)
router.get('/:id', checkPatientAccess, patientController.getPatientById);

// 4. Update patient details (Enforces strict data isolation)
router.put('/:id', checkPatientAccess, patientController.updatePatient);

// 5. Add clinical consultation / medical record (Enforces strict data isolation)
router.post('/:id/records', checkPatientAccess, authorize('doctor'), patientController.addMedicalRecord);

module.exports = router;
