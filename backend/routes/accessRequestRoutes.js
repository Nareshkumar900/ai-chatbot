/**
 * Access Request Routes
 */
const express = require('express');
const router = express.Router();
const accessRequestController = require('../controllers/accessRequestController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Search patient by Unique Medical ID (Doctor only)
router.post('/search', authorize('doctor'), accessRequestController.searchPatientByMedicalId);

// Create access request (Doctor only)
router.post('/', authorize('doctor'), accessRequestController.createAccessRequest);

// Get list of requests (Filtered according to user role)
router.get('/', accessRequestController.getAccessRequests);

// Approve access request (Patient or Admin)
router.put('/:id/approve', accessRequestController.approveAccessRequest);

// Reject access request (Patient or Admin)
router.put('/:id/reject', accessRequestController.rejectAccessRequest);

// Revoke access (Patient or Admin)
router.put('/:id/revoke', accessRequestController.revokeAccess);

module.exports = router;
