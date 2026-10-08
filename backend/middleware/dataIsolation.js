/**
 * Strict Doctor-Patient Data Isolation Middleware
 * Enforces role-based and relationship-based access control at the API level.
 * Prevents unauthorized access or IDOR (Insecure Direct Object Reference).
 */
const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { getClientIp } = require('../utils/helpers');

/**
 * Middleware: Verify that the current user has legitimate permission to access
 * a specific patient's medical data.
 * Param: `patientId` (from req.params.patientId or req.params.id)
 */
async function checkPatientAccess(req, res, next) {
  try {
    const rawPatientId = req.params.patientId || req.params.id;
    const patientId = parseInt(rawPatientId, 10);
    const clientIp = getClientIp(req);

    if (isNaN(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format.'
      });
    }

    // 1. Fetch patient existence
    const patient = await db.getOne(
      'SELECT id, user_id, registered_by_doctor_id, medical_id, name FROM patients WHERE id = ?',
      [patientId]
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found in the medical system.'
      });
    }

    // 2. Admin has system-level oversight
    if (req.user.role === 'admin') {
      req.targetPatient = patient;
      return next();
    }

    // 3. Patient accessing their own record
    if (req.user.role === 'patient') {
      if (req.user.patientId === patientId) {
        req.targetPatient = patient;
        return next();
      } else {
        await logAudit({
          userId: req.user.id,
          action: 'PATIENT_UNAUTHORIZED_CROSS_ACCESS_BLOCKED',
          patientId: patientId,
          details: `Patient user ${req.user.username} attempted to access Patient ID ${patientId}`,
          ipAddress: clientIp
        });
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are only authorized to view your own medical records.'
        });
      }
    }

    // 4. Doctor accessing patient data:
    // STRICT DATA ISOLATION RULE:
    // A doctor can access if:
    // Case A: Doctor is the registering doctor (custodian)
    // Case B: Doctor has an APPROVED access request that is currently valid
    if (req.user.role === 'doctor') {
      const doctorId = req.user.doctorId;

      // Case A: Registering doctor
      if (patient.registered_by_doctor_id === doctorId) {
        req.targetPatient = patient;
        req.accessType = 'PRIMARY_REGISTERED_DOCTOR';
        return next();
      }

      // Case B: Approved access request check
      const approvedRequest = await db.getOne(
        `SELECT id, status, approved_at, expires_at 
         FROM access_requests 
         WHERE patient_id = ? 
           AND requesting_doctor_id = ? 
           AND status = 'APPROVED'
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY id DESC LIMIT 1`,
        [patientId, doctorId]
      );

      if (approvedRequest) {
        req.targetPatient = patient;
        req.accessType = 'SHARED_APPROVED_ACCESS';
        return next();
      }

      // Access Denied: Record in Security Audit Log
      await logAudit({
        userId: req.user.id,
        action: 'UNAUTHORIZED_ACCESS_BLOCKED',
        patientId: patientId,
        details: `Dr. ${req.doctor ? req.doctor.name : req.user.username} (ID: ${doctorId}) was blocked from accessing Patient ID ${patientId} (${patient.medical_id}) without approved consent.`,
        ipAddress: clientIp
      });

      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have authorization to view this patient\'s medical records. You must submit an access request using the Patient Medical ID and receive patient consent first.',
        isAccessRestricted: true,
        patientMedicalId: patient.medical_id
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: Unrecognized role.'
    });
  } catch (err) {
    console.error('[DataIsolation Middleware] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Security authorization check failed.'
    });
  }
}

module.exports = {
  checkPatientAccess
};
