/**
 * Secure File Upload Middleware (Multer)
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure destination directories exist
const CERT_DIR = path.join(__dirname, '../uploads/certificates');
const LICENSE_DIR = path.join(__dirname, '../uploads/licenses');

[CERT_DIR, LICENSE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

// Certificate / Report Storage Configuration
const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CERT_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `med_doc_${uniqueSuffix}${ext}`);
  }
});

// Doctor Medical License Storage Configuration
const licenseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LICENSE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc_license_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are permitted.'),
      false
    );
  }
};

const uploadCertificate = multer({
  storage: certificateStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: fileFilter
});

const uploadLicense = multer({
  storage: licenseStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

module.exports = {
  uploadCertificate,
  uploadLicense,
  CERT_DIR,
  LICENSE_DIR
};
