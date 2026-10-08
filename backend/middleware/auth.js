/**
 * Authentication & Authorization Middleware
 */
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_medical_jwt_key_2026_aiml_secure_token';

/**
 * Verify JWT token and attach user & role context
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }

    // Fetch user from database
    const user = await db.getOne(
      'SELECT id, username, role, email, phone, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user || user.status === 'suspended') {
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.'
      });
    }

    req.user = user;

    // Attach doctor or patient profile details
    if (user.role === 'doctor') {
      const doctor = await db.getOne('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
      req.doctor = doctor;
      req.user.doctorId = doctor ? doctor.id : null;
      req.user.isVerified = doctor ? Boolean(doctor.is_verified) : false;
    } else if (user.role === 'patient') {
      const patient = await db.getOne('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      req.patient = patient;
      req.user.patientId = patient ? patient.id : null;
      req.user.medicalId = patient ? patient.medical_id : null;
    }

    next();
  } catch (err) {
    console.error('[Auth Middleware] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
}

/**
 * Role-based authorization guard
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}].`
      });
    }
    next();
  };
}

/**
 * Check if doctor is verified before allowing patient creation / clinical actions
 */
function checkDoctorVerified(req, res, next) {
  if (req.user.role === 'doctor' && !req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account Pending Verification: Your medical license is under verification by the administrator. You cannot register patients or perform clinical actions until approved.'
    });
  }
  next();
}

module.exports = {
  authenticate,
  authorize,
  checkDoctorVerified
};
