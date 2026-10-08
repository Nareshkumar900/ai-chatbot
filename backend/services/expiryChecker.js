/**
 * Medical Certificate & Report Expiry Monitoring Service
 * Periodically reviews medical certificates and triggers notifications
 * for expiring, expired, or re-upload required documents.
 */
const db = require('../config/db');

const THRESHOLD_DAYS = parseInt(process.env.CERTIFICATE_REVIEW_THRESHOLD_DAYS || '30', 10);

/**
 * Scan all medical documents and calculate current status.
 * Automatically inserts notifications for patients and their registering doctors.
 */
async function checkCertificatesExpiry() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const documents = await db.query(`
      SELECT 
        d.id, d.patient_id, d.document_type, d.file_name, d.issue_date, d.review_date, d.status,
        p.name AS patient_name, p.user_id AS patient_user_id, p.registered_by_doctor_id,
        u_doc.id AS doctor_user_id, doc.name AS doctor_name
      FROM medical_documents d
      JOIN patients p ON d.patient_id = p.id
      JOIN doctors doc ON p.registered_by_doctor_id = doc.id
      JOIN users u_doc ON doc.user_id = u_doc.id
    `);

    for (const doc of documents) {
      if (!doc.review_date) continue;

      const reviewDate = new Date(doc.review_date);
      reviewDate.setHours(0, 0, 0, 0);

      const diffTime = reviewDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStatus = doc.status;

      if (diffDays < 0) {
        newStatus = 'EXPIRED';
      } else if (diffDays <= THRESHOLD_DAYS) {
        newStatus = 'EXPIRING_SOON';
      } else {
        newStatus = 'VALID';
      }

      // Update document status if changed
      if (newStatus !== doc.status) {
        await db.query('UPDATE medical_documents SET status = ? WHERE id = ?', [newStatus, doc.id]);

        // Send notifications if not already sent recently for this document
        if (newStatus === 'EXPIRING_SOON') {
          // Check if notification already exists
          const existingPatNotif = await db.getOne(
            `SELECT id FROM notifications 
             WHERE user_id = ? AND type = 'CERT_EXPIRING' AND metadata LIKE ?`,
            [doc.patient_user_id, `%"documentId":${doc.id}%`]
          );

          if (!existingPatNotif) {
            // Patient notification
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
               VALUES (?, 'CERT_EXPIRING', 'Medical Certificate Expiring Soon', ?, ?, datetime('now', 'localtime'))`,
              [
                doc.patient_user_id,
                `Your ${doc.document_type} is due for review on ${doc.review_date} (within ${diffDays} days). Please consult your doctor for renewal.`,
                JSON.stringify({ documentId: doc.id, patientId: doc.patient_id })
              ]
            );

            // Doctor notification
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
               VALUES (?, 'CERT_EXPIRING', 'Patient Certificate Review Notice', ?, ?, datetime('now', 'localtime'))`,
              [
                doc.doctor_user_id,
                `Patient ${doc.patient_name}'s ${doc.document_type} requires review by ${doc.review_date}.`,
                JSON.stringify({ documentId: doc.id, patientId: doc.patient_id })
              ]
            );
          }
        } else if (newStatus === 'EXPIRED') {
          const existingExpNotif = await db.getOne(
            `SELECT id FROM notifications 
             WHERE user_id = ? AND type = 'CERT_EXPIRED' AND metadata LIKE ?`,
            [doc.patient_user_id, `%"documentId":${doc.id}%`]
          );

          if (!existingExpNotif) {
            // Patient expired notification
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
               VALUES (?, 'CERT_EXPIRED', 'Medical Certificate Outdated', ?, ?, datetime('now', 'localtime'))`,
              [
                doc.patient_user_id,
                `Your ${doc.document_type} expired on ${doc.review_date}. Please upload an updated certificate or consult Dr. ${doc.doctor_name}.`,
                JSON.stringify({ documentId: doc.id, patientId: doc.patient_id })
              ]
            );

            // Doctor expired notification
            await db.query(
              `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
               VALUES (?, 'CERT_EXPIRED', 'Patient Certificate Expired', ?, ?, datetime('now', 'localtime'))`,
              [
                doc.doctor_user_id,
                `Patient ${doc.patient_name}'s ${doc.document_type} has expired (expired on ${doc.review_date}). Re-upload or clinical renewal required.`,
                JSON.stringify({ documentId: doc.id, patientId: doc.patient_id })
              ]
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('[ExpiryChecker] Error checking certificate expiration:', err.message);
  }
}

/**
 * Start the background expiration checker job
 * Runs once immediately, and every 6 hours thereafter
 */
function startExpiryMonitor() {
  console.log('[ExpiryChecker] Background Certificate Monitoring Service started.');
  checkCertificatesExpiry(); // Run on startup
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  setInterval(checkCertificatesExpiry, INTERVAL_MS);
}

module.exports = {
  checkCertificatesExpiry,
  startExpiryMonitor
};
