/**
 * AI Medical Chat & Clinical Intelligence Routes
 */
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkPatientAccess } = require('../middleware/dataIsolation');

router.use(authenticate);

// Send message to Claude AI Medical Assistant (Available to Patients, Doctors, Admin)
router.post('/chat', chatController.sendMessage);
router.post('/message', chatController.sendMessage);

// Medical Report & Certificate AI Parameter Analyzer (Claude + MATLAB Deep Learning)
router.post('/analyze-report', chatController.analyzeReport);

// MATLAB Deep Learning Serious Situation & Risk Classification
router.post('/matlab-risk-analysis', chatController.getMatlabRiskAnalysis);
router.post('/matlab-risk', chatController.getMatlabRiskAnalysis);

// Doctor Clinical AI Summary & SOAP Note Generator (Enforces patient access authorization)
router.get(
  '/doctor-summary/:patientId',
  authorize('doctor'),
  checkPatientAccess,
  chatController.getDoctorClinicalSummary
);

// Get chat conversation history
router.get('/history', chatController.getChatHistory);

module.exports = router;
