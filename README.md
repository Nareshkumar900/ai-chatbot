# AI Medical Doctor–Patient Management System

> **A Full-Stack Healthcare Platform with Strict Doctor Data Isolation, Patient Consent-Based Record Sharing, Automated Medical Certificate Expiration Tracking, and Clinical AI Assistant.**

---

## 📑 Table of Contents

1. [System Overview & Architecture](#-system-overview--architecture)
2. [Key Capabilities & Features](#-key-capabilities--features)
3. [User Roles & Access Levels](#-user-roles--access-levels)
4. [Strict Doctor Data Isolation & Security](#-strict-doctor-data-isolation--security)
5. [Patient Consent & Unique Medical ID System](#-patient-consent--unique-medical-id-system)
6. [Medical Certificate Expiration Engine](#-medical-certificate-expiration-engine)
7. [AI Medical Assistant & Safety Guardrails](#-ai-medical-assistant--safety-guardrails)
8. [Database Schema & Seed Baseline](#-database-schema--seed-baseline)
9. [Pre-Seeded Demo Test Accounts](#-pre-seeded-demo-test-accounts)
10. [REST API Documentation](#-rest-api-documentation)
11. [Installation & Local Execution](#-installation--local-execution)
12. [Project File Structure](#-project-file-structure)

---

## 🏥 System Overview & Architecture

The **AI Medical Doctor–Patient Management System** is a full-stack clinical platform engineered to address one of the most critical challenges in digital healthcare: **unauthorized cross-doctor data access, patient privacy, and clinical documentation efficiency**.

```
+-----------------------------------------------------------------------------------+
|                                 WEB FRONTEND                                      |
|  - Landing Page | Doctor Portal | Patient Portal | Admin Center | AI Chat UI      |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS / REST APIs / Bearer JWT
                                         v
+-----------------------------------------------------------------------------------+
|                               EXPRESS.JS BACKEND                                  |
|  - Auth Middleware (JWT + Role RBAC)                                              |
|  - Strict Data Isolation Guard (Custodian vs Approved Consent Check)              |
|  - Rate Limiter & Helmet Security Headers                                         |
|  - Multer Secure File Uploads                                                     |
|  - Expiry Checker Background Service (6h Interval)                                |
|  - AI Medical Engine (Emergency Detection + Personalized Context + SOAP Copilot) |
|  - Tamper-Resistant Audit Logger                                                  |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Relational SQL Queries
                                         v
+-----------------------------------------------------------------------------------+
|                                RELATIONAL DATABASE                                |
|  - Out-of-the-Box: Pure JS/Wasm SQLite (medical_system.sqlite)                    |
|  - Enterprise Production: MySQL 8.0+ (schema.sql & seed.sql)                      |
|  - Tables: users, doctors, patients, medical_records, medical_documents,         |
|            access_requests, notifications, chatbot_conversations, audit_logs      |
+-----------------------------------------------------------------------------------+
```

---

## 🌟 Key Capabilities & Features

1. **Doctor Registration & Verification**:
   - Comprehensive registration: DOB, Gender, Phone, Email, Medical Registration Number, Department/Specialization, Hospital Name, Address, Years of Experience, Qualification, and Medical License Document Upload.
   - Status tracking (`verified` vs `pending_verification`).
2. **Patient Registration by Authorized Doctor**:
   - Only authenticated & verified doctors can enroll patients.
   - Automatically generates:
     - **Patient User ID** (e.g. `pt.782941`)
     - **Temporary Password** (e.g. `Med@8392!`)
     - **Unique Patient Medical ID** (e.g. `MED-IND-2026-8F92K1`)
   - Registering doctor receives an instant credential slip with a 1-click copy feature. The patient's actual password is never exposed to other doctors.
3. **Strict Doctor Data Isolation**:
   - Enforced on backend APIs via `checkPatientAccess` middleware.
   - A doctor can **only** see patients they registered or patients who explicitly approved an access request.
   - Cross-doctor unauthorized URL tampering returns `403 Forbidden` and is logged in the security audit log.
4. **Consent-Based Access Sharing**:
   - Doctor B searches using Patient Medical ID (`MED-IND-2026-8F92K1`).
   - System displays non-sensitive identity metadata only (no medical history or reports).
   - Doctor B inputs a clinical reason and submits the request.
   - Patient receives an in-app notification and can **APPROVE** or **REJECT**.
   - Patient can **REVOKE** access at any time.
5. **Medical Certificate Expiration Engine**:
   - Automatic background service periodically tracks issue dates and review/expiry dates.
   - Document statuses: `VALID`, `EXPIRING_SOON` (<= 30 days), `EXPIRED`, `RE_UPLOAD_REQUIRED`.
   - Automated in-app notifications sent to both patient and doctor.
6. **AI Medical Assistant**:
   - ChatGPT-style interactive interface.
   - **Emergency Detection**: Instant red alert banner when acute symptoms are detected (chest pain, shortness of breath, stroke, severe bleeding, anaphylaxis).
   - **Personalized Context**: Ingests patient allergies, chronic conditions, and medications for context-aware queries.
   - **Lab Report Analyzer**: Extracts parameters (e.g. Glucose, HbA1c, Cholesterol, Creatinine), compares against reference ranges, and explains in simple terms.
   - **Doctor AI Clinical Copilot**: Generates structured SOAP notes (Subjective, Objective, Assessment, Plan) and clinical history summaries.

---

## 👥 User Roles & Access Levels

| Role | Permissions & Responsibilities |
| :--- | :--- |
| **Doctor** | Register & login; manage profile; enroll new patients; upload certificates; consult patients; request access to external patients via Medical ID; receive approval notifications; use AI clinical tools. |
| **Patient** | Login via credentials; view personal health records; view uploaded certificates & reports; approve/reject/revoke doctor access requests; receive certificate expiration alerts; use AI health chatbot. |
| **Admin** | System management; approve/verify doctor medical licenses; view all doctors and patients; inspect system security audit logs; view platform metrics. |

---

## 🔒 Strict Doctor Data Isolation & Security

To prevent **Insecure Direct Object Reference (IDOR)**, data isolation is enforced at the backend middleware layer:

```javascript
// backend/middleware/dataIsolation.js
if (req.user.role === 'doctor') {
  const doctorId = req.user.doctorId;

  // Case A: Registering doctor (custodian)
  if (patient.registered_by_doctor_id === doctorId) {
    return next();
  }

  // Case B: Approved access request check
  const approved = await db.getOne(`
    SELECT id FROM access_requests 
    WHERE patient_id = ? AND requesting_doctor_id = ? AND status = 'APPROVED'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
  `, [patientId, doctorId]);

  if (approved) return next();

  // Access Denied: Record Security Audit Event
  await logAudit({
    userId: req.user.id,
    action: 'UNAUTHORIZED_ACCESS_BLOCKED',
    patientId: patientId,
    details: `Doctor ID ${doctorId} blocked from accessing Patient ${patientId} without consent.`
  });

  return res.status(403).json({
    success: false,
    message: 'Access Denied: You do not have authorization to view this patient\'s records.'
  });
}
```

---

## 💳 Patient Consent & Unique Medical ID System

- **Format**: `MED-IND-YYYY-XXXXXX` (e.g., `MED-IND-2026-8F92K1`).
- Generated cryptographically at patient enrollment.
- Protects national ID numbers (e.g., Aadhaar, SSN).
- Flow:
  1. Doctor B inputs `MED-IND-2026-8F92K1`.
  2. System returns minimal metadata (Name, Age, Gender, Hospital).
  3. Doctor B submits reason for consultation.
  4. Patient receives notification on their dashboard.
  5. Patient clicks **Approve** or **Reject**.
  6. Audit trail records the transaction with timestamp and IP address.

---

## ⏰ Medical Certificate Expiration Engine

- **Service**: `backend/services/expiryChecker.js`
- **Execution**: Runs on server boot and every 6 hours thereafter.
- **Thresholds**:
  - `VALID`: > 30 days before review date.
  - `EXPIRING_SOON`: <= 30 days remaining.
  - `EXPIRED`: Past review date.
  - `RE_UPLOAD_REQUIRED`: Doctor requests a fresh laboratory or fitness test.
- Sends dual notifications:
  - **To Patient**: *"Your Medical Fitness Certificate is due for review on 2026-10-15. Please consult your doctor for renewal."*
  - **To Doctor**: *"Patient Rahul Verma's Medical Fitness Certificate requires review by 2026-10-15."*

---

## 🤖 AI Medical Assistant & Safety Guardrails

The AI Assistant follows strict medical ethics and safety standards:

1. **Mandatory Disclaimer**: Every response clearly states that the assistant is informational and does not replace a licensed medical doctor.
2. **Emergency Detection**: Identifies critical conditions (crushing chest pain, FAST stroke symptoms, breathing difficulty, anaphylaxis) and displays an immediate red alert directing the user to 911 / 112 / local emergency care.
3. **No Definitive Diagnoses**: Speaks in terms of clinical possibilities to discuss with a physician.
4. **No Prescription Issuance**: Does not prescribe medications or advise altering prescribed dosages.
5. **Contextual Awareness**: Incorporates patient-specific allergies, active medications, and chronic conditions when authenticated.
6. **Dual Mode Engine**: Supports Google Gemini API (`GEMINI_API_KEY`) with an intelligent clinical knowledge fallback for offline and local evaluation.

---

## 🗄 Database Schema & Seed Baseline

The database schema is defined in [database/schema.sql](file:///c:/Users/Admin/OneDrive/Desktop/AIML%20chatbot/database/schema.sql) and [database/seed.sql](file:///c:/Users/Admin/OneDrive/Desktop/AIML%20chatbot/database/seed.sql):

- `users`: Core credentials and roles (`doctor`, `patient`, `admin`).
- `doctors`: Doctor profiles, hospital, specialization, registration number, verification flag.
- `patients`: Patient demographics, custodian doctor ID, medical ID, allergies, chronic conditions, current medications.
- `medical_records`: Chronological consultations, diagnoses, vitals, prescriptions.
- `medical_documents`: Uploaded certificates, lab panels, issue dates, review dates, validity status.
- `access_requests`: Consent-sharing requests, status (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`), clinical reasons, timestamps.
- `notifications`: User notifications with read/unread flags.
- `chatbot_conversations`: Conversation logs and emergency flags.
- `audit_logs`: Tamper-resistant security log (actions, user IDs, patient IDs, IP addresses, timestamps).

---

## 🔑 Pre-Seeded Demo Test Accounts

The system includes pre-seeded accounts for evaluation:

| Role | Username | Password | Profile Highlights |
| :--- | :--- | :--- | :--- |
| **Doctor (Primary)** | `dr.sharma` | `Doctor@123` | Dr. Rajesh Sharma, Cardiologist (Apollo Hospital). Custodian of Patient Rahul Verma & Sunita Mehta. |
| **Doctor (Secondary)** | `dr.patel` | `Doctor@123` | Dr. Priya Patel, Pulmonologist (Fortis Healthcare). Has pending access request for Rahul Verma. |
| **Doctor (Pending)** | `dr.verma` | `Doctor@123` | Dr. Amit Verma, Neurologist (AIIMS Delhi). Unverified account to test admin approval. |
| **Patient 1** | `pt.rahul` | `Patient@123` | Rahul Verma (`MED-IND-2026-8F92K1`). B+, Hypertension, Penicillin allergy. Has certificate expiring in 10 days. |
| **Patient 2** | `pt.sunita` | `Patient@123` | Sunita Mehta (`MED-IND-2026-3B7X9Q`). O+, Type 2 Diabetes, Sulfa allergy. |
| **Patient 3** | `pt.vikram` | `Patient@123` | Vikram Singh (`MED-IND-2026-9C4L2M`). A+, Chronic Bronchitis, Expired certificate. |
| **Administrator** | `admin` | `Admin@123` | Full administrative oversight, doctor verification, and audit logs. |

---

## 📡 REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/doctor/register` - Register doctor (supports multipart/form-data for license).
- `POST /api/auth/login` - Universal login (Doctor, Patient, Admin).
- `POST /api/auth/doctor/login` - Doctor login.
- `POST /api/auth/patient/login` - Patient login.
- `GET /api/auth/me` - Current authenticated user profile.

### Patients (`/api/patients`)
- `POST /api/patients` - Enroll new patient (Doctor only). Auto-generates Medical ID, User ID, Temp Password.
- `GET /api/patients` - Get patient list (Enforces data isolation: registered + approved only).
- `GET /api/patients/:id` - Get patient details & chronological history (Strict data isolation check).
- `PUT /api/patients/:id` - Update patient details.
- `POST /api/patients/:id/records` - Add clinical consultation note.

### Medical Documents (`/api/medical-documents`)
- `POST /api/medical-documents` - Upload certificate / lab report.
- `GET /api/medical-documents/patient/:patientId` - List patient documents.
- `GET /api/medical-documents/:id/download` - Securely stream / download document.

### Access Requests (`/api/access-requests`)
- `POST /api/access-requests/search` - Search patient by Medical ID (non-sensitive info only).
- `POST /api/access-requests` - Submit access request with clinical reason.
- `GET /api/access-requests` - List access requests for the user.
- `PUT /api/access-requests/:id/approve` - Patient approves access.
- `PUT /api/access-requests/:id/reject` - Patient rejects access.
- `PUT /api/access-requests/:id/revoke` - Patient revokes access.

### Notifications (`/api/notifications`)
- `GET /api/notifications` - Get user notifications & unread count.
- `PUT /api/notifications/:id/read` - Mark single notification as read.
- `PUT /api/notifications/read-all` - Mark all notifications as read.

### AI Medical Assistant (`/api/chat`)
- `POST /api/chat/message` - Send symptom or health question (Emergency detector active).
- `POST /api/chat/analyze-report` - Extract & explain lab report parameters.
- `GET /api/chat/doctor-summary/:patientId` - Generate AI SOAP note & clinical summary for doctor.
- `GET /api/chat/history` - Fetch previous conversation history.

### Admin Management (`/api/admin`)
- `GET /api/admin/stats` - Overall system metrics.
- `GET /api/admin/doctors` - All doctors & verification statuses.
- `PUT /api/admin/doctors/:id/verify` - Approve / verify doctor license.
- `GET /api/admin/audit-logs` - Inspect security audit logs.

---

## 🚀 Installation & Local Execution

### Prerequisites
- Node.js LTS (v18, v20, v22, or v24)
- npm (v9+)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
*(By default, `DB_TYPE=sqlite` is active, requiring zero external database configuration).*

### Step 3: Run the Application
```bash
npm run dev
```
*(Or `npm start`)*

Open your browser and navigate to:
```
http://localhost:5000
```

### Optional: Reset / Re-seed Database
```bash
npm run seed
```

### Optional: Switch to MySQL
To use MySQL instead of SQLite:
1. Ensure MySQL server is running.
2. In `.env`, set:
   ```ini
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=medical_system_db
   ```
3. Start the server (`npm run dev`). The database schema and seed data will be created automatically.

---

## 📁 Project File Structure

```
AIML chatbot/
├── backend/
│   ├── config/
│   │   ├── db.js                 # Dual SQLite / MySQL adapter
│   │   └── seedRunner.js         # Standalone database seeder
│   ├── controllers/
│   │   ├── accessRequestController.js  # Consent sharing workflow
│   │   ├── adminController.js          # Admin & verification
│   │   ├── authController.js           # Login & registration
│   │   ├── chatController.js           # AI Medical assistant
│   │   ├── documentController.js       # Certificate & report uploads
│   │   ├── notificationController.js   # In-app notifications
│   │   └── patientController.js        # Patient management & isolation
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & RBAC
│   │   ├── dataIsolation.js      # Strict Doctor Data Isolation Guard
│   │   └── upload.js             # Multer secure file upload handler
│   ├── routes/
│   │   ├── accessRequestRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── patientRoutes.js
│   ├── services/
│   │   ├── aiService.js          # Clinical reasoning & emergency detector
│   │   └── expiryChecker.js      # Background certificate monitor
│   ├── uploads/
│   │   ├── certificates/         # Medical certificates & reports
│   │   └── licenses/             # Doctor medical licenses
│   ├── utils/
│   │   ├── auditLogger.js        # Audit trail logging
│   │   └── helpers.js            # ID generators & utilities
│   └── server.js                 # Main Express server
├── database/
│   ├── schema.sql                # MySQL DDL schema
│   ├── seed.sql                  # Seed data script
│   └── medical_system.sqlite     # SQLite database file
├── frontend/
│   ├── css/
│   │   └── style.css             # Healthcare UI design system
│   ├── js/
│   │   ├── api.js                # API client with JWT handling
│   │   ├── app.js                # App coordinator & view router
│   │   ├── auth.js               # Authentication controller
│   │   ├── doctor.js             # Doctor dashboard & patient list
│   │   ├── patient.js            # Patient dashboard & consent sharing
│   │   ├── admin.js              # Admin verification & audit logs
│   │   └── chat.js               # AI Chatbot & Report Analyzer UI
│   └── index.html                # Master responsive HTML5 layout
├── .env.example                  # Environment configuration template
├── .env                          # Local active environment variables
├── package.json                  # Dependencies & execution scripts
└── README.md                     # Comprehensive project documentation
```

---

## 🛡️ Medical Safety & Compliance Summary

- **HIPAA / GDPR Aligned Principles**: Cryptographic Medical IDs, zero government identity leakage, strict purpose-driven access requests, patient consent gates, and audit trails.
- **AI Safety Standards**: Immediate emergency escalation, clear non-physician disclaimer, non-diagnostic phrasing, and no medication prescriptions.
