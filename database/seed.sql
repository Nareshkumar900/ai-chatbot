-- ==============================================================================
-- AI Medical Doctor–Patient Management System
-- Seed Data (Realistic Medical Baseline)
-- Passwords:
-- Admin: Admin@123
-- Doctors: Doctor@123
-- Patients: Patient@123
-- ==============================================================================

USE `medical_system_db`;

-- 1. Insert Users
INSERT INTO `users` (`id`, `username`, `password_hash`, `role`, `email`, `phone`, `status`, `created_at`) VALUES
(1, 'admin', '$2a$10$S/6vVHg2oKp6TuAW69VW/OG2vQDirsN3NPYn8B5VZu5nh0RD3eMYy', 'admin', 'admin@medicare.ai', '+91 98110 00001', 'active', '2026-01-01 09:00:00'),
(2, 'dr.sharma', '$2a$10$HAvywoL3TD8f9IzMGARAoO1Eg4bWc2M6EmkXSKGaZ7L/O/25QzXwW', 'doctor', 'dr.sharma@apollo.org', '+91 98220 12345', 'active', '2026-01-02 10:00:00'),
(3, 'dr.patel', '$2a$10$HAvywoL3TD8f9IzMGARAoO1Eg4bWc2M6EmkXSKGaZ7L/O/25QzXwW', 'doctor', 'dr.patel@fortis.org', '+91 98330 67890', 'active', '2026-01-03 11:30:00'),
(4, 'dr.verma', '$2a$10$HAvywoL3TD8f9IzMGARAoO1Eg4bWc2M6EmkXSKGaZ7L/O/25QzXwW', 'doctor', 'dr.verma@aiims.edu', '+91 98440 99887', 'pending_verification', '2026-01-04 14:00:00'),
(5, 'pt.rahul', '$2a$10$EQM.H/DBp3FTMPZYP2gUj.hBNT6x24GU3WuchZ9jGITi7FnrpmaEC', 'patient', 'rahul.verma@example.com', '+91 99111 22334', 'active', '2026-01-10 10:00:00'),
(6, 'pt.sunita', '$2a$10$EQM.H/DBp3FTMPZYP2gUj.hBNT6x24GU3WuchZ9jGITi7FnrpmaEC', 'patient', 'sunita.mehta@example.com', '+91 99222 33445', 'active', '2026-01-15 11:30:00'),
(7, 'pt.vikram', '$2a$10$EQM.H/DBp3FTMPZYP2gUj.hBNT6x24GU3WuchZ9jGITi7FnrpmaEC', 'patient', 'vikram.singh@example.com', '+91 99333 44556', 'active', '2026-01-20 14:15:00');

-- 2. Insert Doctors
INSERT INTO `doctors` (`id`, `user_id`, `name`, `date_of_birth`, `gender`, `address`, `specialization`, `hospital`, `hospital_address`, `qualification`, `experience`, `medical_registration_number`, `license_document`, `is_verified`, `created_at`) VALUES
(1, 2, 'Dr. Rajesh Sharma', '1978-04-12', 'Male', 'Sector 14, Noida, UP', 'Cardiology', 'Apollo Multispeciality Hospital', 'Sarita Vihar, Delhi Mathura Road, New Delhi', 'MBBS, MD (General Medicine), DM (Cardiology)', 18, 'MCI-2008-88319', 'license_sharma.pdf', 1, '2026-01-02 10:00:00'),
(2, 3, 'Dr. Priya Patel', '1984-08-25', 'Female', 'Koramangala, Bengaluru, Karnataka', 'Pulmonology & Critical Care', 'Fortis Healthcare', 'Bannerghatta Road, Bengaluru', 'MBBS, MD (Pulmonary Medicine), FCCP', 12, 'MCI-2012-44210', 'license_patel.pdf', 1, '2026-01-03 11:30:00'),
(3, 4, 'Dr. Amit Verma', '1990-11-05', 'Male', 'Ansari Nagar, New Delhi', 'Neurology', 'AIIMS New Delhi', 'Sri Aurobindo Marg, Ansari Nagar, New Delhi', 'MBBS, DNB (Neurology)', 6, 'MCI-2018-19284', 'license_verma.pdf', 0, '2026-01-04 14:00:00');

-- 3. Insert Patients (Registered by doctors)
INSERT INTO `patients` (`id`, `user_id`, `registered_by_doctor_id`, `medical_id`, `name`, `date_of_birth`, `gender`, `blood_group`, `phone`, `email`, `address`, `emergency_contact`, `existing_diseases`, `allergies`, `current_medications`, `previous_surgeries`, `family_medical_history`, `important_conditions`, `created_at`) VALUES
(1, 5, 1, 'MED-IND-2026-8F92K1', 'Rahul Verma', '1988-06-15', 'Male', 'B+', '+91 99111 22334', 'rahul.verma@example.com', 'Flat 402, Green Park Apartments, New Delhi', 'Pooja Verma (Spouse) - +91 99111 22335', 'Primary Hypertension, Mild Bronchial Asthma', 'Penicillin, Shellfish', 'Amlodipine 5mg OD, Salbutamol Inhaler PRN', 'Appendectomy (2018)', 'Father: Coronary Artery Disease, Mother: Type 2 Diabetes', 'Monitor blood pressure weekly; carries inhaler for cold weather bronchospasms.', '2026-01-10 10:00:00'),
(2, 6, 1, 'MED-IND-2026-3B7X9Q', 'Sunita Mehta', '1975-02-20', 'Female', 'O+', '+91 99222 33445', 'sunita.mehta@example.com', 'C-12, Vasant Kunj, New Delhi', 'Anil Mehta (Brother) - +91 99222 33446', 'Type 2 Diabetes Mellitus, Hyperlipidemia', 'Sulfa drugs', 'Metformin 500mg BD, Atorvastatin 10mg HS', 'None', 'Both parents had Type 2 Diabetes', 'HbA1c targets below 7.0%; diabetic foot exam pending.', '2026-01-15 11:30:00'),
(3, 7, 2, 'MED-IND-2026-9C4L2M', 'Vikram Singh', '1982-09-10', 'Male', 'A+', '+91 99333 44556', 'vikram.singh@example.com', '15/A, Indiranagar, Bengaluru', 'Deepa Singh (Wife) - +91 99333 44557', 'Chronic Bronchitis, Seasonal Rhinitis', 'Aspirin (triggers wheezing)', 'Formoterol + Budesonide Turbuhaler BD, Cetirizine 10mg PRN', 'Nasal Septoplasty (2021)', 'Maternal grandfather: COPD', 'Smoker (reformed, stopped 2024); requires spirometry every 6 months.', '2026-01-20 14:15:00');

-- 4. Medical Records
INSERT INTO `medical_records` (`id`, `patient_id`, `doctor_id`, `record_type`, `diagnosis_notes`, `treatment_plan`, `medications`, `allergies`, `medical_history`, `vital_signs`, `created_at`) VALUES
(1, 1, 1, 'Consultation', 'Patient presented for routine cardiovascular evaluation. BP slightly elevated at 138/88 mmHg. Heart sounds normal (S1, S2 clear, no murmur). Lungs clear to auscultation.', 'Continue Amlodipine 5mg. Dietary sodium restriction (< 2g/day). 30 mins brisk walking 5 days/week. Review in 3 months.', 'Amlodipine 5mg tab once daily', 'Penicillin', 'Hypertension diagnosed in 2022', 'BP: 138/88 mmHg, Pulse: 74 bpm, SpO2: 99%, Weight: 76 kg, Temp: 98.4 F', '2026-01-10 10:30:00'),
(2, 2, 1, 'Consultation', 'Diabetic follow-up. Fasting Blood Sugar 126 mg/dL, Post Prandial 164 mg/dL. Peripheral pulses palpable, no diabetic neuropathy detected.', 'Titrate Metformin to 850mg BD. Continue Atorvastatin. Nutritional consultation for low glycemic index diet.', 'Metformin 850mg BD, Atorvastatin 10mg HS', 'Sulfa drugs', 'Type 2 Diabetes diagnosed 2020', 'BP: 124/80 mmHg, Pulse: 78 bpm, SpO2: 98%, Weight: 68 kg, Temp: 98.6 F', '2026-01-15 12:00:00'),
(3, 3, 2, 'Consultation', 'Complaints of productive morning cough and mild wheeze following cold exposure. Expiratory rhonchi present bilaterally.', 'Nebulization given in clinic. Prescribed Formoterol + Budesonide. Advised chest X-ray and avoid air pollutants.', 'Formoterol 6mcg + Budesonide 200mcg BD', 'Aspirin', 'Chronic Bronchitis since 2023', 'BP: 120/78 mmHg, Pulse: 82 bpm, SpO2: 96%, RR: 18/min, Temp: 98.8 F', '2026-01-20 14:45:00');

-- 5. Medical Documents (with issue_date and review_date for expiration testing)
INSERT INTO `medical_documents` (`id`, `patient_id`, `uploaded_by`, `document_type`, `file_name`, `file_path`, `file_size`, `mime_type`, `issue_date`, `review_date`, `doctor_notes`, `diagnosis`, `status`, `uploaded_at`) VALUES
(1, 1, 2, 'Medical Fitness Certificate', 'fitness_certificate_rahul.pdf', 'sample_fitness_cert.pdf', 1048576, 'application/pdf', '2026-04-10', '2026-10-15', 'Certificate valid for domestic employment. Requires cardiovascular review before renewal.', 'Primary Hypertension - Stage 1 (Controlled)', 'EXPIRING_SOON', '2026-04-10 11:00:00'),
(2, 2, 2, 'Comprehensive Metabolic & Lipid Panel', 'lipid_panel_sunita.pdf', 'sample_lipid_panel.pdf', 845200, 'application/pdf', '2026-08-01', '2027-02-01', 'Lipid panel indicates mild hypertriglyceridemia. Liver enzymes normal.', 'Type 2 Diabetes, Hyperlipidemia', 'VALID', '2026-08-01 13:00:00'),
(3, 3, 3, 'Pulmonary Function & Fitness Certificate', 'pft_report_vikram.pdf', 'sample_pft_report.pdf', 1245000, 'application/pdf', '2025-09-01', '2026-09-01', 'Annual spirometry renewal expired. Patient must repeat spirometry and consult pulmonologist.', 'Chronic Bronchitis', 'EXPIRED', '2025-09-01 15:30:00');

-- 6. Access Requests (Dr. Patel requesting access to Dr. Sharma\'s patient Rahul Verma)
INSERT INTO `access_requests` (`id`, `patient_id`, `requesting_doctor_id`, `status`, `reason`, `requested_at`, `approved_at`, `expires_at`) VALUES
(1, 1, 2, 'PENDING', 'Second opinion requested regarding persistent nocturnal cough and potential broncho-cardiac medication interaction.', '2026-10-04 16:30:00', NULL, NULL),
(2, 3, 1, 'APPROVED', 'Cardiovascular clearance evaluation prior to pulmonary rehabilitation program.', '2026-09-15 10:00:00', '2026-09-15 11:30:00', '2027-09-15 11:30:00');

-- 7. Notifications
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `is_read`, `metadata`, `created_at`) VALUES
(1, 5, 'ACCESS_REQUEST', 'New Doctor Access Request', 'Dr. Priya Patel (Fortis Healthcare - Pulmonology) has requested access to your medical records for a second opinion.', 0, '{"requestId": 1, "doctorId": 2}', '2026-10-04 16:30:00'),
(2, 5, 'CERT_EXPIRING', 'Medical Certificate Expiring Soon', 'Your Medical Fitness Certificate is due for review on 2026-10-15 (within 10 days). Please consult your doctor for renewal.', 0, '{"documentId": 1}', '2026-10-05 08:00:00'),
(3, 2, 'CERT_EXPIRING', 'Patient Certificate Notice', 'Patient Rahul Verma\'s Medical Fitness Certificate requires review by 2026-10-15.', 0, '{"patientId": 1, "documentId": 1}', '2026-10-05 08:00:00'),
(4, 7, 'CERT_EXPIRED', 'Medical Certificate Outdated', 'Your Pulmonary Function & Fitness Certificate expired on 2026-09-01. Please upload an updated certificate or consult Dr. Priya Patel.', 0, '{"documentId": 3}', '2026-09-02 09:00:00'),
(5, 2, 'ACCESS_APPROVED', 'Access Request Approved', 'Patient Vikram Singh approved your access request for cardiovascular clearance.', 1, '{"patientId": 3, "requestId": 2}', '2026-09-15 11:30:00');

-- 8. Audit Logs
INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `patient_id`, `details`, `ip_address`, `timestamp`) VALUES
(1, 2, 'PATIENT_REGISTRATION', 1, 'Dr. Rajesh Sharma registered new patient Rahul Verma (Medical ID: MED-IND-2026-8F92K1)', '127.0.0.1', '2026-01-10 10:00:00'),
(2, 2, 'CERTIFICATE_UPLOAD', 1, 'Dr. Rajesh Sharma uploaded Medical Fitness Certificate for Rahul Verma', '127.0.0.1', '2026-04-10 11:00:00'),
(3, 3, 'ACCESS_REQUEST_CREATED', 1, 'Dr. Priya Patel requested access to Patient Rahul Verma (Medical ID: MED-IND-2026-8F92K1)', '127.0.0.1', '2026-10-04 16:30:00'),
(4, 2, 'UNAUTHORIZED_ACCESS_BLOCKED', 3, 'Blocked unauthorized direct record query attempt prior to approval', '127.0.0.1', '2026-09-14 18:20:00'),
(5, 5, 'PATIENT_LOGIN', 1, 'Patient Rahul Verma logged in to patient dashboard', '127.0.0.1', '2026-10-05 09:15:00');
