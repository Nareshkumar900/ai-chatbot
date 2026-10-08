/**
 * Admin Management Routes
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

// System stats
router.get('/stats', adminController.getSystemStats);

// Manage Doctors
router.get('/doctors', adminController.getAllDoctors);
router.put('/doctors/:id/verify', adminController.verifyDoctor);
router.get('/doctors/:id/license', adminController.downloadDoctorLicense);
router.post('/doctors/:id/analyze-license', adminController.analyzeLicenseAuthenticity);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
