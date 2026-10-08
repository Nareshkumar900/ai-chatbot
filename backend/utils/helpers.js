/**
 * Helper Utilities
 */
const crypto = require('crypto');

/**
 * Generate Unique Patient Medical ID
 * Format: MED-IND-YYYY-XXXXXX (e.g., MED-IND-2026-8F92K1)
 */
function generateMedicalId() {
  const year = new Date().getFullYear();
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MED-IND-${year}-${randomHex}`;
}

/**
 * Generate Patient Username / User ID
 * Format: PT-XXXXXX
 */
function generatePatientUserId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `pt.${randomDigits}`;
}

/**
 * Generate Secure Temporary Password
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pass = 'Med@';
  for (let i = 0; i < 4; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pass += Math.floor(10 + Math.random() * 90) + '!';
  return pass;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

/**
 * Extract Client IP Address from request
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    '127.0.0.1'
  );
}

module.exports = {
  generateMedicalId,
  generatePatientUserId,
  generateTempPassword,
  calculateAge,
  getClientIp
};
