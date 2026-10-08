/**
 * Doctor Module - Patient Management & Clinical Workflows
 */

const DoctorModule = {
  patients: [],
  currentPatientId: null,

  async init() {
    this.bindEvents();
    await this.loadDashboardData();
  },

  bindEvents() {
    // Patient Search in list
    const searchInput = document.getElementById('doc-patient-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filterPatients(e.target.value));
    }

    // Register Patient Form
    const regForm = document.getElementById('doctor-new-patient-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => this.handleRegisterPatient(e));
    }

    // Access Request Search Form
    const accessSearchForm = document.getElementById('doc-access-search-form');
    if (accessSearchForm) {
      accessSearchForm.addEventListener('submit', (e) => this.handleSearchMedicalId(e));
    }

    // Access Request Submit Form
    const accessSubmitForm = document.getElementById('doc-access-submit-form');
    if (accessSubmitForm) {
      accessSubmitForm.addEventListener('submit', (e) => this.handleSubmitAccessRequest(e));
    }

    // New Consultation Record Form
    const consultForm = document.getElementById('doc-new-record-form');
    if (consultForm) {
      consultForm.addEventListener('submit', (e) => this.handleAddConsultationRecord(e));
    }

    // Upload New Certificate Form
    const uploadCertForm = document.getElementById('doc-upload-cert-form');
    if (uploadCertForm) {
      uploadCertForm.addEventListener('submit', (e) => this.handleUploadCertificate(e));
    }
  },

  async loadDashboardData() {
    try {
      // Refresh current user verification from server
      try {
        const meRes = await window.api.get('/auth/me');
        if (meRes.success && meRes.user) {
          window.api.setCurrentUser({
            ...window.api.getCurrentUser(),
            ...meRes.user
          });
        }
      } catch (e) { /* ignore offline */ }

      const user = window.api.getCurrentUser();
      const docNameEl = document.getElementById('doc-name-display');
      const docHospitalEl = document.getElementById('doc-hospital-display');
      if (docNameEl && user) docNameEl.textContent = user.name || user.username;
      if (docHospitalEl && user) docHospitalEl.textContent = `${user.hospital || 'Hospital'} • ${user.specialization || 'Medicine'}`;

      // Check Verification Banner
      const unverifiedBanner = document.getElementById('doc-unverified-banner');
      if (unverifiedBanner) {
        unverifiedBanner.style.display = (user && user.isVerified) ? 'none' : 'flex';
      }

      // Fetch Patients
      const res = await window.api.get('/patients');
      this.patients = res.patients || [];
      this.renderPatientsTable(this.patients);
      this.updateStatistics();
      this.renderExpiringCertificatesAlert();

      // Fetch Access Requests sent by this doctor
      this.loadSentAccessRequests();
    } catch (err) {
      console.error('Error loading doctor dashboard:', err);
      App.showAlert('Failed to load patient data: ' + err.message, 'danger');
    }
  },

  updateStatistics() {
    const totalCount = this.patients.length;
    const primaryCount = this.patients.filter(p => p.access_type === 'PRIMARY_CUSTODIAN').length;
    const sharedCount = this.patients.filter(p => p.access_type === 'APPROVED_SHARED_ACCESS').length;
    const expiringCount = this.patients.filter(p => p.certificate_status === 'EXPIRING_SOON' || p.certificate_status === 'EXPIRED').length;

    const elTotal = document.getElementById('stat-doc-total-patients');
    const elPrimary = document.getElementById('stat-doc-primary-patients');
    const elShared = document.getElementById('stat-doc-shared-patients');
    const elExpiring = document.getElementById('stat-doc-expiring-certs');

    if (elTotal) elTotal.textContent = totalCount;
    if (elPrimary) elPrimary.textContent = primaryCount;
    if (elShared) elShared.textContent = sharedCount;
    if (elExpiring) elExpiring.textContent = expiringCount;
  },

  renderExpiringCertificatesAlert() {
    const banner = document.getElementById('doc-certificate-warning-banner');
    const listEl = document.getElementById('doc-expiring-certs-list');
    if (!banner || !listEl) return;

    const expiring = this.patients.filter(p => p.certificate_status === 'EXPIRING_SOON' || p.certificate_status === 'EXPIRED');
    if (expiring.length === 0) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    listEl.innerHTML = expiring.map(p => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
        <span><strong>${p.name}</strong> (${p.medical_id}) - Certificate Status: <span class="badge ${p.certificate_status === 'EXPIRED' ? 'badge-expired' : 'badge-expiring'}">${p.certificate_status}</span></span>
        <button class="btn btn-sm btn-primary" onclick="DoctorModule.openUploadCertModal(${p.id}, '${p.name}')">Upload Renewal</button>
      </div>
    `).join('');
  },

  renderPatientsTable(patients) {
    const tbody = document.getElementById('doc-patients-tbody');
    if (!tbody) return;

    if (patients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
            <i class="fa-solid fa-user-shield" style="font-size: 32px; color: var(--primary); margin-bottom: 12px; display: block;"></i>
            <strong>No authorized patients found in your registry.</strong><br>
            <span style="font-size: 0.85rem;">You can register a new patient or request access to existing patients using their unique Medical ID.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = patients.map(p => {
      const certBadge = p.certificate_status === 'EXPIRED'
        ? '<span class="badge badge-expired"><i class="fa-solid fa-triangle-exclamation"></i> Expired</span>'
        : p.certificate_status === 'EXPIRING_SOON'
        ? '<span class="badge badge-expiring"><i class="fa-solid fa-clock"></i> Expiring Soon</span>'
        : '<span class="badge badge-valid"><i class="fa-solid fa-circle-check"></i> Valid</span>';

      const accessBadge = p.access_type === 'PRIMARY_CUSTODIAN'
        ? '<span class="badge badge-primary-custodian">Registered By You</span>'
        : '<span class="badge badge-shared-access">Patient-Approved Access</span>';

      return `
        <tr>
          <td>
            <strong>${p.name}</strong><br>
            <small style="color: var(--text-muted);">${p.gender}, ${p.age || 'N/A'} yrs</small>
          </td>
          <td><code style="font-weight: 700; color: var(--primary);">${p.medical_id}</code></td>
          <td><span class="badge" style="background:#e2e8f0;">${p.blood_group || 'N/A'}</span></td>
          <td>${accessBadge}</td>
          <td>${certBadge}</td>
          <td><small style="color: var(--text-muted);">${p.last_visit ? p.last_visit.substring(0, 10) : 'Registered'}</small></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-primary" onclick="DoctorModule.viewPatientDetails(${p.id})">
                <i class="fa-solid fa-eye"></i> View
              </button>
              <button class="btn btn-sm btn-secondary" onclick="DoctorModule.openAddRecordModal(${p.id}, '${p.name}')">
                <i class="fa-solid fa-notes-medical"></i> Consult
              </button>
              <button class="btn btn-sm btn-outline" onclick="DoctorModule.openUploadCertModal(${p.id}, '${p.name}')">
                <i class="fa-solid fa-file-arrow-up"></i> Certificate
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterPatients(term) {
    const q = term.toLowerCase().trim();
    if (!q) {
      this.renderPatientsTable(this.patients);
      return;
    }
    const filtered = this.patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.medical_id.toLowerCase().includes(q) ||
      (p.blood_group && p.blood_group.toLowerCase().includes(q))
    );
    this.renderPatientsTable(filtered);
  },

  // View Single Patient Details Modal
  async viewPatientDetails(patientId) {
    try {
      this.currentPatientId = patientId;
      App.showLoading(true);

      const res = await window.api.get(`/patients/${patientId}`);
      const p = res.patient;
      const records = res.medicalRecords || [];
      const docs = res.documents || [];

      document.getElementById('modal-patient-name').textContent = p.name;
      document.getElementById('modal-patient-medid').textContent = p.medical_id;
      document.getElementById('modal-patient-age-gender').textContent = `${p.gender}, ${p.age || 'N/A'} years`;
      document.getElementById('modal-patient-blood').textContent = p.blood_group;
      document.getElementById('modal-patient-phone').textContent = p.phone;
      document.getElementById('modal-patient-emergency').textContent = p.emergency_contact;
      document.getElementById('modal-patient-address').textContent = p.address || 'N/A';

      // Clinical summary
      document.getElementById('modal-patient-diseases').textContent = p.existing_diseases || 'None';
      const allergyEl = document.getElementById('modal-patient-allergies');
      if (allergyEl) {
        allergyEl.textContent = p.allergies || 'None';
        allergyEl.className = p.allergies && p.allergies.toLowerCase() !== 'none' ? 'badge badge-expired' : 'badge badge-valid';
      }
      document.getElementById('modal-patient-meds').textContent = p.current_medications || 'None';
      document.getElementById('modal-patient-surgeries').textContent = p.previous_surgeries || 'None';
      document.getElementById('modal-patient-family').textContent = p.family_medical_history || 'None';

      // Render Chronological Medical Records
      const historyContainer = document.getElementById('modal-patient-records-timeline');
      if (historyContainer) {
        if (records.length === 0) {
          historyContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No consultation records logged yet.</p>';
        } else {
          historyContainer.innerHTML = records.map(r => `
            <div style="padding: 12px 16px; border-left: 3px solid var(--primary); background: var(--bg-main); border-radius: 6px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">
                <span><strong>${r.record_type}</strong> by Dr. ${r.doctor_name} (${r.hospital_name})</span>
                <span>${r.created_at ? r.created_at.substring(0, 16) : ''}</span>
              </div>
              <p style="font-size: 0.92rem; font-weight: 600; color: var(--text-main);">${r.diagnosis_notes}</p>
              ${r.vital_signs ? `<small style="display: block; color: var(--secondary-dark); margin-top: 4px;"><strong>Vitals:</strong> ${r.vital_signs}</small>` : ''}
              ${r.medications ? `<small style="display: block; color: var(--primary-dark); margin-top: 2px;"><strong>Prescription:</strong> ${r.medications}</small>` : ''}
              ${r.treatment_plan ? `<small style="display: block; color: var(--text-muted); margin-top: 2px;"><strong>Plan:</strong> ${r.treatment_plan}</small>` : ''}
            </div>
          `).join('');
        }
      }

      // Render Medical Documents
      const docsContainer = document.getElementById('modal-patient-docs-list');
      if (docsContainer) {
        if (docs.length === 0) {
          docsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No medical certificates uploaded.</p>';
        } else {
          docsContainer.innerHTML = docs.map(d => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-main); border-radius: var(--radius-md); margin-bottom: 8px;">
              <div>
                <strong>${d.document_type}</strong> (${d.file_name})<br>
                <small style="color: var(--text-muted);">Issue: ${d.issue_date} | Review/Expiry: <strong>${d.review_date}</strong></small><br>
                <small style="color: var(--text-muted);">AI image screening: ${d.ai_verification_status || 'NOT_RUN'}${d.ai_verification_score == null ? '' : ` (${d.ai_verification_score}%)`}</small>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${d.status === 'EXPIRED' ? 'badge-expired' : d.status === 'EXPIRING_SOON' ? 'badge-expiring' : 'badge-valid'}">${d.status}</span>
                <button class="btn btn-sm btn-outline" onclick="DoctorModule.downloadDoc(${d.id})">
                  <i class="fa-solid fa-download"></i> Download
                </button>
              </div>
            </div>
          `).join('');
        }
      }

      // Reset AI Clinical note preview
      const aiSummaryBox = document.getElementById('doctor-ai-soap-box');
      if (aiSummaryBox) aiSummaryBox.style.display = 'none';

      App.openModal('patient-details-modal');
    } catch (err) {
      App.showAlert('Data Isolation Error: ' + err.message, 'danger');
    } finally {
      App.showLoading(false);
    }
  },

  // Doctor AI Clinical Assistant Generator
  async generateAiClinicalSummary() {
    if (!this.currentPatientId) return;
    const box = document.getElementById('doctor-ai-soap-box');
    const content = document.getElementById('doctor-ai-soap-content');
    const btn = document.getElementById('btn-doc-ai-summary');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Clinical Summary...';

    try {
      const res = await window.api.get(`/chat/doctor-summary/${this.currentPatientId}`);
      if (res.success) {
        box.style.display = 'block';
        content.innerHTML = App.formatMarkdown(res.summary);
      }
    } catch (err) {
      App.showAlert('AI Clinical copilot failed: ' + err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI SOAP Summary';
    }
  },

  // Register New Patient Form Handler
  async handleRegisterPatient(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Registering Patient...';

    const formData = new FormData(form);

    try {
      const res = await window.api.postFormData('/patients', formData);
      if (res.success) {
        form.reset();
        App.showAlert('Patient registered successfully!', 'success');
        
        // Show the Patient Credential Card Modal
        this.showCredentialsModal(res.credentials);
        await this.loadDashboardData();
      }
    } catch (err) {
      App.showAlert('Registration failed: ' + err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Register Patient & Generate Credentials';
    }
  },

  showCredentialsModal(c) {
    document.getElementById('cred-patient-name').textContent = c.patientName;
    document.getElementById('cred-medical-id').textContent = c.medicalId;
    document.getElementById('cred-username').textContent = c.username;
    document.getElementById('cred-temp-pass').textContent = c.temporaryPassword;
    document.getElementById('cred-email').textContent = c.email;
    document.getElementById('cred-doctor-name').textContent = c.registeredByDoctor;

    App.openModal('patient-credentials-modal');
  },

  copyCredentials() {
    const name = document.getElementById('cred-patient-name').textContent;
    const medId = document.getElementById('cred-medical-id').textContent;
    const user = document.getElementById('cred-username').textContent;
    const pass = document.getElementById('cred-temp-pass').textContent;

    const slip = `AI MEDICAL PORTAL - PATIENT CREDENTIAL SLIP
Patient Name: ${name}
Unique Medical ID: ${medId}
Patient Username: ${user}
Temporary Password: ${pass}
Login URL: ${window.location.origin}/#login

Please change your password upon initial login. Keep your Unique Medical ID safe to share with authorized medical specialists.`;

    navigator.clipboard.writeText(slip);
    App.showAlert('Credentials copied to clipboard!', 'success');
  },

  // Search Patient By Medical ID (Step 1 of Access Sharing)
  async handleSearchMedicalId(e) {
    e.preventDefault();
    const form = e.target;
    const input = form.medicalId.value.trim();
    const previewBox = document.getElementById('doc-access-patient-preview');

    if (!input) return;

    try {
      const res = await window.api.post('/access-requests/search', { medicalId: input });
      const p = res.patient;

      previewBox.style.display = 'block';
      document.getElementById('doc-access-preview-name').textContent = p.name;
      document.getElementById('doc-access-preview-id').textContent = p.medicalId;
      document.getElementById('doc-access-preview-demographics').textContent = `${p.gender}, ${p.age} years | Blood: ${p.bloodGroup}`;
      document.getElementById('doc-access-preview-hospital').textContent = `Registered at: ${p.registeredHospital}`;
      document.getElementById('doc-access-target-patient-id').value = p.id;

      const submitCard = document.getElementById('doc-access-submit-card');
      if (p.isRegisteringDoctor) {
        submitCard.innerHTML = '<p class="badge badge-primary-custodian" style="padding:10px; font-size:0.9rem;">You are already the primary registering doctor for this patient with full access.</p>';
      } else if (p.currentAccessStatus === 'APPROVED') {
        submitCard.innerHTML = '<p class="badge badge-valid" style="padding:10px; font-size:0.9rem;">You already have active approved access to this patient\'s records.</p>';
      } else if (p.currentAccessStatus === 'PENDING') {
        submitCard.innerHTML = '<p class="badge badge-pending" style="padding:10px; font-size:0.9rem;">An access request is currently pending patient approval.</p>';
      } else {
        submitCard.style.display = 'block';
      }
    } catch (err) {
      previewBox.style.display = 'none';
      App.showAlert(err.message, 'danger');
    }
  },

  // Submit Access Request (Step 2 of Access Sharing)
  async handleSubmitAccessRequest(e) {
    e.preventDefault();
    const form = e.target;
    const patientId = document.getElementById('doc-access-target-patient-id').value;
    const reason = form.reason.value.trim();
    const btn = form.querySelector('button[type="submit"]');

    if (!reason) {
      App.showAlert('Please provide a medical/clinical reason for requesting access.', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Sending Request...';

    try {
      const res = await window.api.post('/access-requests', { patientId, reason });
      if (res.success) {
        App.showAlert(res.message, 'success');
        form.reset();
        document.getElementById('doc-access-patient-preview').style.display = 'none';
        document.getElementById('doc-access-submit-card').style.display = 'none';
        this.loadSentAccessRequests();
      }
    } catch (err) {
      App.showAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Send Access Request to Patient';
    }
  },

  async loadSentAccessRequests() {
    try {
      const res = await window.api.get('/access-requests');
      const container = document.getElementById('doc-access-requests-list');
      if (!container) return;

      const requests = res.requests || [];
      if (requests.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No access requests submitted.</p>';
        return;
      }

      container.innerHTML = requests.map(r => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-main); border-radius: var(--radius-md); margin-bottom: 10px;">
          <div>
            <strong>${r.patient_name}</strong> (<code>${r.patient_medical_id}</code>)<br>
            <small style="color: var(--text-muted);">Reason: "${r.reason}"</small><br>
            <small style="color: var(--text-muted);">Requested: ${r.requested_at ? r.requested_at.substring(0, 16) : ''}</small>
          </div>
          <div>
            <span class="badge ${r.status === 'APPROVED' ? 'badge-approved' : r.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending'}">${r.status}</span>
            ${r.status === 'APPROVED' ? `<button class="btn btn-sm btn-primary" style="margin-left:8px;" onclick="DoctorModule.viewPatientDetails(${r.patient_id})">View Records</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Failed to load sent access requests:', err);
    }
  },

  // Open Consult Record Modal
  openAddRecordModal(patientId, patientName) {
    this.currentPatientId = patientId;
    document.getElementById('record-patient-id').value = patientId;
    document.getElementById('record-patient-name-display').textContent = patientName;
    App.openModal('add-consultation-modal');
  },

  async handleAddConsultationRecord(e) {
    e.preventDefault();
    const form = e.target;
    const patientId = document.getElementById('record-patient-id').value;
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.innerHTML = 'Saving Consultation...';

    const payload = {
      recordType: form.recordType.value,
      diagnosisNotes: form.diagnosisNotes.value,
      vitalSigns: form.vitalSigns.value,
      medications: form.medications.value,
      treatmentPlan: form.treatmentPlan.value
    };

    try {
      const res = await window.api.post(`/patients/${patientId}/records`, payload);
      if (res.success) {
        App.showAlert('Consultation record logged successfully!', 'success');
        App.closeModal('add-consultation-modal');
        form.reset();
        await this.loadDashboardData();
      }
    } catch (err) {
      App.showAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save Consultation Record';
    }
  },

  // Open Upload Certificate Modal
  openUploadCertModal(patientId, patientName) {
    this.currentPatientId = patientId;
    document.getElementById('upload-cert-patient-id').value = patientId;
    document.getElementById('upload-cert-patient-name-display').textContent = patientName;
    App.openModal('upload-certificate-modal');
  },

  async handleUploadCertificate(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.innerHTML = 'Uploading Certificate...';

    const formData = new FormData(form);

    try {
      const res = await window.api.postFormData('/medical-documents', formData);
      if (res.success) {
        App.showAlert(res.message || 'Medical certificate uploaded.', res.document && res.document.aiVerificationStatus === 'REJECTED' ? 'warning' : 'success');
        App.closeModal('upload-certificate-modal');
        form.reset();
        await this.loadDashboardData();
      }
    } catch (err) {
      App.showAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Upload Medical Document';
    }
  },

  async downloadDoc(docId) {
    window.open(`/api/medical-documents/${docId}/download?token=${window.api.getToken()}`, '_blank');
  }
};

window.DoctorModule = DoctorModule;
