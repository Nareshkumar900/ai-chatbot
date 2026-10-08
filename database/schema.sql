-- ==============================================================================
-- AI Medical Doctor–Patient Management System
-- Database Schema (MySQL 8.0+ Compatible)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `medical_system_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `medical_system_db`;

-- 1. Users Table (Core Auth for Doctor, Patient, Admin)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('doctor', 'patient', 'admin') NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS `doctors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `date_of_birth` DATE NULL,
  `gender` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `specialization` VARCHAR(150) NOT NULL,
  `hospital` VARCHAR(200) NOT NULL,
  `hospital_address` TEXT NULL,
  `qualification` VARCHAR(150) NOT NULL,
  `experience` INT NOT NULL DEFAULT 0,
  `medical_registration_number` VARCHAR(100) NOT NULL UNIQUE,
  `license_document` VARCHAR(255) NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Patients Table (Strict Data Isolation: registered_by_doctor_id defines primary custodian)
CREATE TABLE IF NOT EXISTS `patients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `registered_by_doctor_id` INT NOT NULL,
  `medical_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `gender` VARCHAR(20) NOT NULL,
  `blood_group` VARCHAR(10) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `address` TEXT NULL,
  `emergency_contact` VARCHAR(150) NOT NULL,
  `existing_diseases` TEXT NULL,
  `allergies` TEXT NULL,
  `current_medications` TEXT NULL,
  `previous_surgeries` TEXT NULL,
  `family_medical_history` TEXT NULL,
  `important_conditions` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`registered_by_doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Medical Records Table (Consultations, Clinical notes, Diagnoses)
CREATE TABLE IF NOT EXISTS `medical_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `record_type` VARCHAR(50) NOT NULL DEFAULT 'Consultation',
  `diagnosis_notes` TEXT NOT NULL,
  `treatment_plan` TEXT NULL,
  `medications` TEXT NULL,
  `allergies` TEXT NULL,
  `medical_history` TEXT NULL,
  `vital_signs` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Medical Documents Table (Certificates, Lab Reports, Scans)
CREATE TABLE IF NOT EXISTS `medical_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `uploaded_by` INT NOT NULL,
  `document_type` VARCHAR(100) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_size` INT NOT NULL DEFAULT 0,
  `mime_type` VARCHAR(100) NOT NULL,
  `issue_date` DATE NOT NULL,
  `review_date` DATE NOT NULL,
  `doctor_notes` TEXT NULL,
  `diagnosis` TEXT NULL,
  `status` ENUM('VALID', 'EXPIRING_SOON', 'EXPIRED', 'RE_UPLOAD_REQUIRED') NOT NULL DEFAULT 'VALID',
  `ai_verification_status` VARCHAR(20) NOT NULL DEFAULT 'NOT_RUN',
  `ai_verification_score` INT NULL,
  `ai_verification_result` TEXT NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Access Requests Table (Patient approval-based data sharing)
CREATE TABLE IF NOT EXISTS `access_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `requesting_doctor_id` INT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NOT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requesting_doctor_id`) REFERENCES `doctors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `metadata` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Chatbot Conversations Table
CREATE TABLE IF NOT EXISTS `chatbot_conversations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `message` TEXT NOT NULL,
  `response` TEXT NOT NULL,
  `is_emergency` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Audit Logs Table (Strict security logging)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `patient_id` INT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(50) NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for high-performance and data isolation lookups
CREATE INDEX idx_patients_medical_id ON `patients`(`medical_id`);
CREATE INDEX idx_patients_doc ON `patients`(`registered_by_doctor_id`);
CREATE INDEX idx_access_requests_patient ON `access_requests`(`patient_id`, `status`);
CREATE INDEX idx_access_requests_doc ON `access_requests`(`requesting_doctor_id`, `status`);
CREATE INDEX idx_docs_review_date ON `medical_documents`(`review_date`, `status`);
CREATE INDEX idx_notifications_user ON `notifications`(`user_id`, `is_read`);
