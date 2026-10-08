/**
 * Admin Management & Audit Controller
 */
const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { getClientIp } = require('../utils/helpers');

/**
 * Get Overall Medical System Statistics
 */
async function getSystemStats(req, res) {
  try {
    const totalDoctors = await db.getOne('SELECT COUNT(*) AS count FROM doctors');
    const verifiedDoctors = await db.getOne('SELECT COUNT(*) AS count FROM doctors WHERE is_verified = 1');
    const pendingDoctors = await db.getOne('SELECT COUNT(*) AS count FROM doctors WHERE is_verified = 0');
    const totalPatients = await db.getOne('SELECT COUNT(*) AS count FROM patients');
    const totalRecords = await db.getOne('SELECT COUNT(*) AS count FROM medical_records');
    const totalDocuments = await db.getOne('SELECT COUNT(*) AS count FROM medical_documents');
    const expiringCertificates = await db.getOne("SELECT COUNT(*) AS count FROM medical_documents WHERE status IN ('EXPIRING_SOON', 'EXPIRED')");
    const pendingAccessRequests = await db.getOne("SELECT COUNT(*) AS count FROM access_requests WHERE status = 'PENDING'");
    const totalAuditEvents = await db.getOne('SELECT COUNT(*) AS count FROM audit_logs');

    return res.json({
      success: true,
      stats: {
        totalDoctors: totalDoctors ? totalDoctors.count : 0,
        verifiedDoctors: verifiedDoctors ? verifiedDoctors.count : 0,
        pendingDoctors: pendingDoctors ? pendingDoctors.count : 0,
        totalPatients: totalPatients ? totalPatients.count : 0,
        totalRecords: totalRecords ? totalRecords.count : 0,
        totalDocuments: totalDocuments ? totalDocuments.count : 0,
        expiringCertificates: expiringCertificates ? expiringCertificates.count : 0,
        pendingAccessRequests: pendingAccessRequests ? pendingAccessRequests.count : 0,
        totalAuditEvents: totalAuditEvents ? totalAuditEvents.count : 0
      }
    });
  } catch (err) {
    console.error('[Admin Stats Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve system statistics.'
    });
  }
}

/**
 * Get All Doctors
 */
async function getAllDoctors(req, res) {
  try {
    const doctors = await db.query(`
      SELECT 
        d.*,
        u.username, u.email, u.phone, u.status AS user_status,
        (SELECT COUNT(*) FROM patients WHERE registered_by_doctor_id = d.id) AS patient_count
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.id DESC
    `);

    return res.json({
      success: true,
      count: doctors.length,
      doctors
    });
  } catch (err) {
    console.error('[Admin Get Doctors Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctors.'
    });
  }
}

/**
 * Verify / Approve a Doctor
 */
async function verifyDoctor(req, res) {
  try {
    const doctorId = req.params.id;
    const { isVerified = true } = req.body;
    const clientIp = getClientIp(req);

    const doctor = await db.getOne('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    const val = isVerified ? 1 : 0;
    await db.query('UPDATE doctors SET is_verified = ? WHERE id = ?', [val, doctorId]);

    // Send Notification to Doctor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, created_at)
      VALUES (?, 'INFO_UPDATE', 'Medical License Verification Update', ?, datetime('now', 'localtime'))
    `, [
      doctor.user_id,
      isVerified
        ? 'Congratulations! Your medical registration and license have been verified by the medical administrator. You now have full access to patient management.'
        : 'Your medical verification has been updated by the administrator.'
    ]);

    await logAudit({
      userId: req.user.id,
      action: isVerified ? 'DOCTOR_VERIFIED' : 'DOCTOR_UNVERIFIED',
      patientId: null,
      details: `Admin ${req.user.username} updated verification for Dr. ${doctor.name} to ${isVerified ? 'VERIFIED' : 'PENDING'}`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: `Doctor Dr. ${doctor.name} verification status set to ${isVerified ? 'VERIFIED' : 'PENDING'}.`
    });
  } catch (err) {
    console.error('[Admin Verify Doctor Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update doctor verification.'
    });
  }
}

/**
 * Get System Audit Logs
 */
async function getAuditLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const logs = await db.query(`
      SELECT 
        a.id, a.user_id, a.action, a.patient_id, a.details, a.ip_address, a.timestamp,
        u.username, u.role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.id DESC
      LIMIT ?
    `, [limit]);

    return res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('[Admin Audit Logs Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs.'
    });
  }
}

/**
 * View / Download Doctor Medical License
 */
async function downloadDoctorLicense(req, res) {
  try {
    const doctorId = req.params.id;
    const doc = await db.getOne('SELECT license_document, name FROM doctors WHERE id = ?', [doctorId]);

    if (!doc || !doc.license_document) {
      return res.status(404).json({
        success: false,
        message: 'No license document associated with this doctor.'
      });
    }

    const path = require('path');
    const fs = require('fs');
    const { LICENSE_DIR } = require('../middleware/upload');
    const filePath = path.join(LICENSE_DIR, doc.license_document);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'License document file not found on storage server.'
      });
    }

    res.setHeader('Content-Disposition', `inline; filename="${doc.license_document}"`);
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve license document.'
    });
  }
}

/**
 * AI License Authenticity Analysis
 * Evaluates whether doctor registration & uploaded license document are genuine or potentially fake
 */
async function analyzeLicenseAuthenticity(req, res) {
  try {
    const doctorId = req.params.id;
    const clientIp = getClientIp(req);

    const doctor = await db.getOne('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.'
      });
    }

    const { analyzeDoctorLicenseAuthenticity } = require('../services/aiService');
    const result = await analyzeDoctorLicenseAuthenticity(doctor);

    await logAudit({
      userId: req.user.id,
      action: 'AI_LICENSE_AUTHENTICITY_ANALYSIS',
      patientId: null,
      details: `Administrator performed AI authenticity audit on Dr. ${doctor.name} (Verdict: ${result.verdict}, Confidence: ${result.confidence})`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      verdict: result.verdict,
      confidence: result.confidence,
      riskLevel: result.riskLevel,
      analysis: result.analysis
    });
  } catch (err) {
    console.error('[AI License Analysis Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze license authenticity: ' + err.message
    });
  }
}

module.exports = {
  getSystemStats,
  getAllDoctors,
  verifyDoctor,
  downloadDoctorLicense,
  analyzeLicenseAuthenticity,
  getAuditLogs
};


