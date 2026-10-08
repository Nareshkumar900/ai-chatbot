/**
 * Doctor-to-Patient Access Request Controller
 * Implements Patient Approval-Based Data Sharing with strict Audit Logging
 */
const db = require('../config/db');
const { calculateAge, getClientIp } = require('../utils/helpers');
const { logAudit } = require('../utils/auditLogger');

/**
 * Step 1: Doctor searches for patient by Unique Medical ID
 * Returns ONLY non-sensitive identity metadata (Name, Medical ID, Age, Gender).
 * Never exposes diagnoses, records, or documents at this stage!
 */
async function searchPatientByMedicalId(req, res) {
  try {
    const { medicalId } = req.body;
    const clientIp = getClientIp(req);

    if (!medicalId || !medicalId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Patient Medical ID.'
      });
    }

    const cleanMedicalId = medicalId.trim().toUpperCase();

    const patient = await db.getOne(`
      SELECT 
        p.id, p.medical_id, p.name, p.date_of_birth, p.gender, p.blood_group,
        p.registered_by_doctor_id,
        doc.name AS registered_by_doctor_name,
        doc.hospital AS registered_by_hospital
      FROM patients p
      JOIN doctors doc ON p.registered_by_doctor_id = doc.id
      WHERE UPPER(p.medical_id) = ?
    `, [cleanMedicalId]);

    if (!patient) {
      await logAudit({
        userId: req.user.id,
        action: 'PATIENT_SEARCH_NOT_FOUND',
        patientId: null,
        details: `Doctor searched for non-existent Medical ID: ${cleanMedicalId}`,
        ipAddress: clientIp
      });

      return res.status(404).json({
        success: false,
        message: 'No patient record found matching that Medical ID. Please verify the ID format (e.g. MED-IND-2026-8F92K1).'
      });
    }

    // Check if doctor is already the registering doctor
    const isRegisteringDoctor = patient.registered_by_doctor_id === req.user.doctorId;

    // Check if there is already an active approved or pending request
    const existingRequest = await db.getOne(`
      SELECT id, status, requested_at, approved_at, expires_at 
      FROM access_requests
      WHERE patient_id = ? AND requesting_doctor_id = ?
      ORDER BY id DESC LIMIT 1
    `, [patient.id, req.user.doctorId]);

    return res.json({
      success: true,
      patient: {
        id: patient.id,
        medicalId: patient.medical_id,
        name: patient.name,
        age: calculateAge(patient.date_of_birth),
        gender: patient.gender,
        bloodGroup: patient.blood_group,
        registeredHospital: patient.registered_by_hospital,
        isRegisteringDoctor,
        currentAccessStatus: isRegisteringDoctor ? 'PRIMARY_CUSTODIAN' : (existingRequest ? existingRequest.status : 'NO_REQUEST')
      }
    });
  } catch (err) {
    console.error('[Search Patient Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to search for patient.'
    });
  }
}

/**
 * Step 2: Doctor submits an Access Request to the Patient
 */
async function createAccessRequest(req, res) {
  try {
    const doctor = req.doctor;
    const { patientId, reason } = req.body;
    const clientIp = getClientIp(req);

    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: 'Only registered medical doctors can request patient record access.'
      });
    }

    if (!patientId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and a clinical reason for access are required.'
      });
    }

    // Fetch patient
    const patient = await db.getOne('SELECT id, user_id, name, medical_id FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Target patient not found.'
      });
    }

    // Check if already registered by this doctor
    if (patient.registered_by_doctor_id === doctor.id) {
      return res.status(400).json({
        success: false,
        message: 'You already have full primary access as this patient\'s registering doctor.'
      });
    }

    // Check for pending request
    const pendingRequest = await db.getOne(`
      SELECT id FROM access_requests 
      WHERE patient_id = ? AND requesting_doctor_id = ? AND status = 'PENDING'
    `, [patient.id, doctor.id]);

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'An access request for this patient is already pending approval.'
      });
    }

    // Create Access Request record
    const result = await db.query(`
      INSERT INTO access_requests (
        patient_id, requesting_doctor_id, status, reason, requested_at
      ) VALUES (?, ?, 'PENDING', ?, datetime('now', 'localtime'))
    `, [patient.id, doctor.id, reason.trim()]);

    const requestId = result.insertId;

    // Send Notification to Patient
    await db.query(`
      INSERT INTO notifications (
        user_id, type, title, message, metadata, created_at
      ) VALUES (?, 'ACCESS_REQUEST', 'New Doctor Access Request', ?, ?, datetime('now', 'localtime'))
    `, [
      patient.user_id,
      `Dr. ${doctor.name} (${doctor.hospital} - ${doctor.specialization}) requested access to your medical records. Reason: "${reason.trim()}"`,
      JSON.stringify({ requestId, doctorId: doctor.id, patientId: patient.id })
    ]);

    // Record in Audit Log
    await logAudit({
      userId: req.user.id,
      action: 'ACCESS_REQUEST_CREATED',
      patientId: patient.id,
      details: `Dr. ${doctor.name} created access request for Patient ${patient.name} (${patient.medical_id}). Reason: ${reason.trim()}`,
      ipAddress: clientIp
    });

    return res.status(201).json({
      success: true,
      message: `Access request submitted to patient ${patient.name}. You will be notified once they approve.`,
      requestId
    });
  } catch (err) {
    console.error('[Create Access Request Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create access request.'
    });
  }
}

/**
 * Step 3: Get Access Requests
 * - For Patient: Lists all requests targeting them
 * - For Doctor: Lists requests sent by them
 */
async function getAccessRequests(req, res) {
  try {
    const user = req.user;
    let requests = [];

    if (user.role === 'patient') {
      requests = await db.query(`
        SELECT 
          ar.id, ar.status, ar.reason, ar.requested_at, ar.approved_at, ar.expires_at,
          doc.name AS doctor_name,
          doc.hospital AS doctor_hospital,
          doc.specialization AS doctor_specialization,
          doc.medical_registration_number AS doctor_reg_no,
          p.name AS patient_name,
          p.medical_id AS patient_medical_id
        FROM access_requests ar
        JOIN doctors doc ON ar.requesting_doctor_id = doc.id
        JOIN patients p ON ar.patient_id = p.id
        WHERE p.user_id = ?
        ORDER BY ar.id DESC
      `, [user.id]);
    } else if (user.role === 'doctor') {
      requests = await db.query(`
        SELECT 
          ar.id, ar.status, ar.reason, ar.requested_at, ar.approved_at, ar.expires_at,
          p.id AS patient_id,
          p.name AS patient_name,
          p.medical_id AS patient_medical_id,
          p.gender, p.blood_group, p.date_of_birth
        FROM access_requests ar
        JOIN patients p ON ar.patient_id = p.id
        WHERE ar.requesting_doctor_id = ?
        ORDER BY ar.id DESC
      `, [user.doctorId]);

      requests = requests.map(r => ({
        ...r,
        age: calculateAge(r.date_of_birth)
      }));
    } else if (user.role === 'admin') {
      requests = await db.query(`
        SELECT 
          ar.id, ar.status, ar.reason, ar.requested_at, ar.approved_at,
          doc.name AS doctor_name, doc.hospital AS doctor_hospital,
          p.name AS patient_name, p.medical_id AS patient_medical_id
        FROM access_requests ar
        JOIN doctors doc ON ar.requesting_doctor_id = doc.id
        JOIN patients p ON ar.patient_id = p.id
        ORDER BY ar.id DESC
      `);
    }

    return res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    console.error('[Get Access Requests Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve access requests.'
    });
  }
}

/**
 * Step 4: Patient APPROVES Doctor Access Request
 */
async function approveAccessRequest(req, res) {
  try {
    const requestId = req.params.id;
    const clientIp = getClientIp(req);

    // Fetch the request
    const request = await db.getOne(`
      SELECT 
        ar.*,
        p.user_id AS patient_user_id, p.name AS patient_name, p.medical_id,
        doc.name AS doctor_name, doc.user_id AS doctor_user_id
      FROM access_requests ar
      JOIN patients p ON ar.patient_id = p.id
      JOIN doctors doc ON ar.requesting_doctor_id = doc.id
      WHERE ar.id = ?
    `, [requestId]);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Access request not found.'
      });
    }

    // Verify patient owns this request (or admin)
    if (req.user.role === 'patient' && request.patient_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only approve requests directed to your profile.'
      });
    }

    // Access expires in 1 year by default
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiresAtStr = expiryDate.toISOString().replace('T', ' ').substring(0, 19);

    await db.query(`
      UPDATE access_requests SET
        status = 'APPROVED',
        approved_at = datetime('now', 'localtime'),
        expires_at = ?
      WHERE id = ?
    `, [expiresAtStr, requestId]);

    // Send Notification to Doctor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
      VALUES (?, 'ACCESS_APPROVED', 'Access Request Approved', ?, ?, datetime('now', 'localtime'))
    `, [
      request.doctor_user_id,
      `Patient ${request.patient_name} (${request.medical_id}) has APPROVED your access request. You can now view their medical records.`,
      JSON.stringify({ requestId, patientId: request.patient_id })
    ]);

    // Record in Audit Log
    await logAudit({
      userId: req.user.id,
      action: 'ACCESS_REQUEST_APPROVED',
      patientId: request.patient_id,
      details: `Patient ${request.patient_name} approved access request #${requestId} for Dr. ${request.doctor_name}`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: `Access granted to Dr. ${request.doctor_name}. They can now view your medical history.`
    });
  } catch (err) {
    console.error('[Approve Access Request Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve access request.'
    });
  }
}

/**
 * Step 5: Patient REJECTS Doctor Access Request
 */
async function rejectAccessRequest(req, res) {
  try {
    const requestId = req.params.id;
    const clientIp = getClientIp(req);

    const request = await db.getOne(`
      SELECT 
        ar.*,
        p.user_id AS patient_user_id, p.name AS patient_name,
        doc.name AS doctor_name, doc.user_id AS doctor_user_id
      FROM access_requests ar
      JOIN patients p ON ar.patient_id = p.id
      JOIN doctors doc ON ar.requesting_doctor_id = doc.id
      WHERE ar.id = ?
    `, [requestId]);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Access request not found.'
      });
    }

    if (req.user.role === 'patient' && request.patient_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only reject requests directed to your profile.'
      });
    }

    await db.query(`
      UPDATE access_requests SET
        status = 'REJECTED'
      WHERE id = ?
    `, [requestId]);

    // Send Notification to Doctor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
      VALUES (?, 'ACCESS_REJECTED', 'Access Request Declined', ?, ?, datetime('now', 'localtime'))
    `, [
      request.doctor_user_id,
      `Patient ${request.patient_name} declined your access request.`,
      JSON.stringify({ requestId, patientId: request.patient_id })
    ]);

    await logAudit({
      userId: req.user.id,
      action: 'ACCESS_REQUEST_REJECTED',
      patientId: request.patient_id,
      details: `Patient ${request.patient_name} rejected access request #${requestId} from Dr. ${request.doctor_name}`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: `Access request from Dr. ${request.doctor_name} has been rejected.`
    });
  } catch (err) {
    console.error('[Reject Access Request Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject access request.'
    });
  }
}

/**
 * Step 6: Patient REVOKES previously approved access
 */
async function revokeAccess(req, res) {
  try {
    const requestId = req.params.id;
    const clientIp = getClientIp(req);

    const request = await db.getOne(`
      SELECT 
        ar.*,
        p.user_id AS patient_user_id, p.name AS patient_name,
        doc.name AS doctor_name, doc.user_id AS doctor_user_id
      FROM access_requests ar
      JOIN patients p ON ar.patient_id = p.id
      JOIN doctors doc ON ar.requesting_doctor_id = doc.id
      WHERE ar.id = ?
    `, [requestId]);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Access record not found.'
      });
    }

    if (req.user.role === 'patient' && request.patient_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only manage your own access permissions.'
      });
    }

    await db.query(`
      UPDATE access_requests SET status = 'REVOKED' WHERE id = ?
    `, [requestId]);

    // Send Notification to Doctor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, created_at)
      VALUES (?, 'ACCESS_REJECTED', 'Patient Access Revoked', ?, datetime('now', 'localtime'))
    `, [
      request.doctor_user_id,
      `Patient ${request.patient_name} has revoked your medical record access.`
    ]);

    await logAudit({
      userId: req.user.id,
      action: 'ACCESS_REVOKED',
      patientId: request.patient_id,
      details: `Patient ${request.patient_name} revoked access permissions from Dr. ${request.doctor_name}`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: `Medical record access has been revoked from Dr. ${request.doctor_name}.`
    });
  } catch (err) {
    console.error('[Revoke Access Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke access.'
    });
  }
}

module.exports = {
  searchPatientByMedicalId,
  createAccessRequest,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  revokeAccess
};
