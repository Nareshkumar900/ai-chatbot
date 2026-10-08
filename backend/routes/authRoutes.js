/**
 * Authentication Routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { uploadLicense } = require('../middleware/upload');

// Doctor Registration (supports optional medical license file upload)
router.post('/doctor/register', uploadLicense.single('licenseDocument'), authController.registerDoctor);

// Login (Doctor, Patient, Admin)
router.post('/login', authController.login);
router.post('/doctor/login', (req, res, next) => {
  req.body.expectedRole = 'doctor';
  authController.login(req, res, next);
});
router.post('/patient/login', (req, res, next) => {
  req.body.expectedRole = 'patient';
  authController.login(req, res, next);
});
router.post('/admin/login', (req, res, next) => {
  req.body.expectedRole = 'admin';
  authController.login(req, res, next);
});

// Current User Profile
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
