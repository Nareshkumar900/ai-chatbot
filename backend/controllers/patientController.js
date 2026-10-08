/**
 * Patient Controller
 * Handles Patient Registration by Doctor, Patient List with strict Data Isolation,
 * Patient Details, and Medical History
 */
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  generateMedicalId,
  generatePatientUserId,
  generateTempPassword,
  calculateAge,
  getClientIp
} = require('../utils/helpers');
const { logAudit } = require('../utils/auditLogger');

/**
 * Register New Patient (Doctor Only)
 * Automatically provisions Patient User, Patient Medical ID, Initial Medical Record,
 * and optional initial Medical Certificate / Document.
 */
async function registerPatient(req, res) {
  try {
    const doctor = req.doctor;
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: 'Only registered medical doctors can create patient records.'
      });
    }

    const {
      name,
      dob,
      gender,
      bloodGroup,
      phone,
      email,
      address,
      emergencyContact,
      existingDiseases,
      allergies,
      currentMedications,
      previousSurgeries,
      familyMedicalHistory,
      importantConditions,
      // Certificate & Medical Info
      certificateType,
      issueDate,
      reviewDate,
      diagnosis,
      doctorNotes,
      treatmentPlan,
      vitalSigns
    } = req.body;

    const clientIp = getClientIp(req);

    // Validation
    if (!name || !dob || !gender || !bloodGroup || !phone || !email || !emergencyContact) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all mandatory personal information fields.'
      });
    }

    // Check if email already used in users table
    const existingUser = await db.getOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already in use by another user profile.'
      });
    }

    // Auto-generate credentials
    const username = generatePatientUserId();
    const tempPassword = generateTempPassword();
    const medicalId = generateMedicalId();

    // Hash temporary password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    // 1. Create Patient User account
    const userResult = await db.query(
      `INSERT INTO users (username, password_hash, role, email, phone, status, created_at)
       VALUES (?, ?, 'patient', ?, ?, 'active', datetime('now', 'localtime'))`,
      [username, passwordHash, email.trim().toLowerCase(), phone.trim()]
    );
    const patientUserId = userResult.insertId;

    // 2. Create Patient Record
    const patientResult = await db.query(
      `INSERT INTO patients (
        user_id, registered_by_doctor_id, medical_id, name, date_of_birth,
        gender, blood_group, phone, email, address, emergency_contact,
        existing_diseases, allergies, current_medications, previous_surgeries,
        family_medical_history, important_conditions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [
        patientUserId,
        doctor.id,
        medicalId,
        name.trim(),
        dob,
        gender,
        bloodGroup,
        phone.trim(),
        email.trim().toLowerCase(),
        address || '',
        emergencyContact.trim(),
        existingDiseases || '',
        allergies || '',
        currentMedications || '',
        previousSurgeries || '',
        familyMedicalHistory || '',
        importantConditions || ''
      ]
    );
    const patientId = patientResult.insertId;

    // 3. Create Initial Medical Record / Consultation
    if (diagnosis || doctorNotes || treatmentPlan || vitalSigns) {
      await db.query(
        `INSERT INTO medical_records (
          patient_id, doctor_id, record_type, diagnosis_notes,
          treatment_plan, medications, allergies, medical_history,
          vital_signs, created_at, updated_at
        ) VALUES (?, ?, 'Initial Registration Consultation', ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [
          patientId,
          doctor.id,
          diagnosis || doctorNotes || 'Initial baseline health consultation and registration.',
          treatmentPlan || 'Routine clinical monitoring.',
          currentMedications || 'None',
          allergies || 'None',
          existingDiseases || 'None',
          vitalSigns || 'Vitals stable at baseline'
        ]
      );
    }

    // 4. Handle Medical Certificate Upload
    let uploadedDocInfo = null;
    if (req.file) {
      const docType = certificateType || 'Medical Registration Certificate';
      const docIssueDate = issueDate || new Date().toISOString().substring(0, 10);
      
      // Default review date to 6 months if not specified
      let docReviewDate = reviewDate;
      if (!docReviewDate) {
        const rev = new Date();
        rev.setMonth(rev.getMonth() + 6);
        docReviewDate = rev.toISOString().substring(0, 10);
      }

      await db.query(
        `INSERT INTO medical_documents (
          patient_id, uploaded_by, document_type, file_name, file_path,
          file_size, mime_type, issue_date, review_date, doctor_notes,
          diagnosis, status, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID', datetime('now', 'localtime'))`,
        [
          patientId,
          req.user.id,
          docType,
          req.file.originalname,
          req.file.filename,
          req.file.size,
          req.file.mimetype,
          docIssueDate,
          docReviewDate,
          doctorNotes || '',
          diagnosis || ''
        ]
      );
      uploadedDocInfo = { fileName: req.file.originalname, reviewDate: docReviewDate };
    }

    // 5. Create Welcome Notification for Patient
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       VALUES (?, 'NEW_PATIENT', 'Welcome to AI Medical Portal', ?, datetime('now', 'localtime'))`,
      [
        patientUserId,
        `Welcome ${name}! Your medical profile and unique Medical ID (${medicalId}) have been generated by Dr. ${doctor.name}.`
      ]
    );

    // 6. Security Audit Log
    await logAudit({
      userId: req.user.id,
      action: 'PATIENT_REGISTRATION',
      patientId: patientId,
      details: `Dr. ${doctor.name} registered Patient ${name} (Medical ID: ${medicalId})`,
      ipAddress: clientIp
    });

    // Return response with temporary credentials for the registering doctor to share with patient
    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully.',
      credentials: {
        patientName: name,
        medicalId: medicalId,
        username: username,
        temporaryPassword: tempPassword,
        email: email,
        phone: phone,
        registeredByDoctor: `Dr. ${doctor.name}`
      },
      patient: {
        id: patientId,
        medicalId,
        name,
        dob,
        gender,
        bloodGroup,
        documentUploaded: !!uploadedDocInfo
      }
    });
  } catch (err) {
    console.error('[Register Patient Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register patient: ' + err.message
    });
  }
}

/**
 * Get Patients List (Strict Data Isolation)
 * Doctors only see:
 * 1. Patients they registered directly
 * 2. Patients who have an approved access request
 */
async function getPatients(req, res) {
  try {
    const user = req.user;
    let patients = [];

    if (user.role === 'admin') {
      // Admin sees system-wide patients
      patients = await db.query(`
        SELECT 
          p.id, p.medical_id, p.name, p.date_of_birth, p.gender, p.blood_group,
          p.phone, p.email, p.created_at, p.registered_by_doctor_id,
          doc.name AS registered_by_doctor_name,
          'OWNED' AS access_type
        FROM patients p
        LEFT JOIN doctors doc ON p.registered_by_doctor_id = doc.id
        ORDER BY p.id DESC
      `);
    } else if (user.role === 'doctor') {
      const doctorId = user.doctorId;

      // STRICT DATA ISOLATION QUERY:
      // Union of:
      // A) Patients registered by this doctor
      // B) Patients who granted approved access
      patients = await db.query(`
        SELECT DISTINCT
          p.id, p.medical_id, p.name, p.date_of_birth, p.gender, p.blood_group,
          p.phone, p.email, p.created_at, p.registered_by_doctor_id,
          CASE 
            WHEN p.registered_by_doctor_id = ? THEN 'PRIMARY_CUSTODIAN'
            ELSE 'APPROVED_SHARED_ACCESS'
          END AS access_type,
          (
            SELECT status FROM medical_documents 
            WHERE patient_id = p.id 
            ORDER BY id DESC LIMIT 1
          ) AS certificate_status,
          (
            SELECT MAX(created_at) FROM medical_records
            WHERE patient_id = p.id
          ) AS last_visit
        FROM patients p
        LEFT JOIN access_requests ar ON p.id = ar.patient_id 
          AND ar.requesting_doctor_id = ? 
          AND ar.status = 'APPROVED'
          AND (ar.expires_at IS NULL OR ar.expires_at > datetime('now', 'localtime'))
        WHERE p.registered_by_doctor_id = ? OR ar.id IS NOT NULL
        ORDER BY p.id DESC
      `, [doctorId, doctorId, doctorId]);
    } else if (user.role === 'patient') {
      // Patient only sees themselves
      patients = await db.query(
        'SELECT id, medical_id, name, date_of_birth, gender, blood_group, phone, email FROM patients WHERE id = ?',
        [user.patientId]
      );
    }

    // Compute age for convenience
    const enrichedPatients = patients.map(p => ({
      ...p,
      age: calculateAge(p.date_of_birth)
    }));

    return res.json({
      success: true,
      count: enrichedPatients.length,
      patients: enrichedPatients
    });
  } catch (err) {
    console.error('[Get Patients Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve patients list.'
    });
  }
}

/**
 * Get Detailed Patient Information & Medical History
 * Protected by checkPatientAccess middleware
 */
async function getPatientById(req, res) {
  try {
    const patientId = req.params.patientId || req.params.id;
    const clientIp = getClientIp(req);

    // Patient record
    const patient = await db.getOne(`
      SELECT 
        p.*,
        doc.name AS registered_by_doctor_name,
        doc.hospital AS registered_by_hospital,
        doc.specialization AS registered_by_specialization
      FROM patients p
      JOIN doctors doc ON p.registered_by_doctor_id = doc.id
      WHERE p.id = ?
    `, [patientId]);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    // Medical Records history in chronological order
    const medicalRecords = await db.query(`
      SELECT 
        mr.*,
        doc.name AS doctor_name,
        doc.hospital AS hospital_name,
        doc.specialization AS specialization
      FROM medical_records mr
      JOIN doctors doc ON mr.doctor_id = doc.id
      WHERE mr.patient_id = ?
      ORDER BY mr.created_at DESC
    `, [patientId]);

    // Medical Documents
    const documents = await db.query(`
      SELECT 
        id, patient_id, uploaded_by, document_type, file_name, file_size,
        mime_type, issue_date, review_date, doctor_notes, diagnosis, status, uploaded_at
      FROM medical_documents
      WHERE patient_id = ?
      ORDER BY id DESC
    `, [patientId]);

    // Log the medical record viewing action in audit logs
    await logAudit({
      userId: req.user.id,
      action: 'PATIENT_RECORD_VIEWED',
      patientId: patient.id,
      details: `${req.user.role.toUpperCase()} ${req.user.username} viewed medical records for ${patient.name} (${patient.medical_id})`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      patient: {
        ...patient,
        age: calculateAge(patient.date_of_birth)
      },
      medicalRecords,
      documents,
      accessType: req.accessType || 'DIRECT'
    });
  } catch (err) {
    console.error('[Get Patient Details Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve patient details.'
    });
  }
}

/**
 * Update Patient Information
 */
async function updatePatient(req, res) {
  try {
    const patientId = req.params.patientId || req.params.id;
    const {
      name,
      dob,
      gender,
      bloodGroup,
      phone,
      address,
      emergencyContact,
      existingDiseases,
      allergies,
      currentMedications,
      previousSurgeries,
      familyMedicalHistory,
      importantConditions
    } = req.body;

    const clientIp = getClientIp(req);

    await db.query(`
      UPDATE patients SET
        name = COALESCE(?, name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        blood_group = COALESCE(?, blood_group),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        existing_diseases = COALESCE(?, existing_diseases),
        allergies = COALESCE(?, allergies),
        current_medications = COALESCE(?, current_medications),
        previous_surgeries = COALESCE(?, previous_surgeries),
        family_medical_history = COALESCE(?, family_medical_history),
        important_conditions = COALESCE(?, important_conditions),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [
      name, dob, gender, bloodGroup, phone, address,
      emergencyContact, existingDiseases, allergies,
      currentMedications, previousSurgeries, familyMedicalHistory,
      importantConditions, patientId
    ]);

    await logAudit({
      userId: req.user.id,
      action: 'PATIENT_INFO_UPDATED',
      patientId: parseInt(patientId, 10),
      details: `${req.user.role.toUpperCase()} ${req.user.username} updated medical profile for Patient ID ${patientId}`,
      ipAddress: clientIp
    });

    return res.json({
      success: true,
      message: 'Patient medical information updated successfully.'
    });
  } catch (err) {
    console.error('[Update Patient Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update patient information.'
    });
  }
}

/**
 * Add New Medical Consultation / Clinical Record
 */
async function addMedicalRecord(req, res) {
  try {
    const patientId = req.params.patientId || req.params.id;
    const doctor = req.doctor;

    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: 'Only authorized medical doctors can create clinical records.'
      });
    }

    const {
      recordType,
      diagnosisNotes,
      treatmentPlan,
      medications,
      allergies,
      medicalHistory,
      vitalSigns
    } = req.body;

    if (!diagnosisNotes) {
      return res.status(400).json({
        success: false,
        message: 'Clinical diagnosis and consultation notes are required.'
      });
    }

    const result = await db.query(`
      INSERT INTO medical_records (
        patient_id, doctor_id, record_type, diagnosis_notes,
        treatment_plan, medications, allergies, medical_history,
        vital_signs, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `, [
      patientId,
      doctor.id,
      recordType || 'Doctor Consultation',
      diagnosisNotes,
      treatmentPlan || '',
      medications || '',
      allergies || '',
      medicalHistory || '',
      vitalSigns || ''
    ]);

    // Send notification to patient
    const patUser = await db.getOne('SELECT user_id, name FROM patients WHERE id = ?', [patientId]);
    if (patUser) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (?, 'INFO_UPDATE', 'New Clinical Consultation Added', ?, datetime('now', 'localtime'))
      `, [
        patUser.user_id,
        `Dr. ${doctor.name} added a new consultation note and diagnosis to your medical records.`
      ]);
    }

    await logAudit({
      userId: req.user.id,
      action: 'MEDICAL_RECORD_CREATED',
      patientId: parseInt(patientId, 10),
      details: `Dr. ${doctor.name} added clinical record for Patient ID ${patientId}`,
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({
      success: true,
      message: 'Medical consultation record added successfully.',
      recordId: result.insertId
    });
  } catch (err) {
    console.error('[Add Medical Record Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add medical record.'
    });
  }
}

module.exports = {
  registerPatient,
  getPatients,
  getPatientById,
  updatePatient,
  addMedicalRecord
};
