/**
 * Audit Logger Utility
 * Records all critical events, security checks, and access attempts into audit_logs table
 */
const db = require('../config/db');

async function logAudit({ userId = null, action, patientId = null, details = '', ipAddress = '127.0.0.1' }) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await db.query(
      `INSERT INTO audit_logs (user_id, action, patient_id, details, ip_address, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, patientId, details, ipAddress, timestamp]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err.message);
  }
}

module.exports = {
  logAudit
};
