/**
 * Patient Module - Personal Medical Records, Consent Sharing, and Expiry Alerts
 */

const PatientModule = {
  profile: null,
  records: [],
  documents: [],
  accessRequests: [],

  async init() {
    this.bindEvents();
    await this.loadPatientData();
  },

  bindEvents() {
    // Patient Document Upload Form
    const uploadForm = document.getElementById('patient-upload-doc-form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => this.handlePatientUploadDoc(e));
    }
  },

  async loadPatientData() {
    try {
      const user = window.api.getCurrentUser();
      if (!user || !user.patientId) return;

      App.showLoading(true);

      // Fetch patient details using authorized endpoint
      const res = await window.api.get(`/patients/${user.patientId}`);
      this.profile = res.patient;
      this.records = res.medicalRecords || [];
      this.documents = res.documents || [];

      this.renderProfile();
      this.renderMedicalHistory();
      this.renderDocuments();
      this.renderCertificateWarnings();

      // Load Doctor Access Requests
      await this.loadAccessRequests();
    } catch (err) {
      console.error('Error loading patient dashboard:', err);
      App.showAlert('Failed to load patient records: ' + err.message, 'danger');
    } finally {
      App.showLoading(false);
    }
  },

  renderProfile() {
    const p = this.profile;
    if (!p) return;

    // Header & Medical ID Widget
    const nameEl = document.getElementById('pat-name-display');
    const medIdEl = document.getElementById('pat-med-id-display');
    const bloodEl = document.getElementById('pat-blood-display');
    const ageGenderEl = document.getElementById('pat-age-gender-display');
    const emergencyEl = document.getElementById('pat-emergency-display');
    const custodianEl = document.getElementById('pat-custodian-display');

    if (nameEl) nameEl.textContent = p.name;
    if (medIdEl) medIdEl.textContent = p.medical_id;
    if (bloodEl) bloodEl.textContent = p.blood_group;
    if (ageGenderEl) ageGenderEl.textContent = `${p.gender}, ${p.age || 'N/A'} yrs`;
    if (emergencyEl) emergencyEl.textContent = p.emergency_contact;
    if (custodianEl) custodianEl.textContent = `Dr. ${p.registered_by_doctor_name} (${p.registered_by_hospital})`;

    // Health overview cards
    const diseasesEl = document.getElementById('pat-diseases-display');
    const allergiesEl = document.getElementById('pat-allergies-display');
    const medsEl = document.getElementById('pat-meds-display');

    if (diseasesEl) diseasesEl.textContent = p.existing_diseases || 'No chronic conditions recorded';
    if (allergiesEl) {
      allergiesEl.textContent = p.allergies || 'None';
      allergiesEl.className = p.allergies && p.allergies.toLowerCase() !== 'none' ? 'badge badge-expired' : 'badge badge-valid';
    }
    if (medsEl) medsEl.textContent = p.current_medications || 'None recorded';
  },

  copyMedicalId() {
    if (!this.profile) return;
    navigator.clipboard.writeText(this.profile.medical_id);
    App.showAlert(`Medical ID ${this.profile.medical_id} copied to clipboard! Share this with a doctor to authorize access.`, 'success');
  },

  renderCertificateWarnings() {
    const banner = document.getElementById('patient-cert-warning-banner');
    const msgEl = document.getElementById('patient-cert-warning-text');
    if (!banner || !msgEl) return;

    const expiringOrExpired = this.documents.filter(d => d.status === 'EXPIRING_SOON' || d.status === 'EXPIRED');

    if (expiringOrExpired.length === 0) {
      banner.style.display = 'none';
      return;
    }

    const first = expiringOrExpired[0];
    banner.style.display = 'flex';
    banner.className = first.status === 'EXPIRED' ? 'alert-banner danger' : 'alert-banner warning';
    
    msgEl.innerHTML = `
      <strong><i class="fa-solid fa-triangle-exclamation"></i> Notice:</strong> Your <strong>${first.document_type}</strong> is ${first.status === 'EXPIRED' ? 'outdated (expired on ' + first.review_date + ')' : 'due for review by ' + first.review_date}.
      Please upload an updated certificate or consult Dr. ${this.profile.registered_by_doctor_name}.
    `;
  },

  renderMedicalHistory() {
    const timeline = document.getElementById('pat-timeline-container');
    if (!timeline) return;

    if (this.records.length === 0) {
      timeline.innerHTML = '<p style="color: var(--text-muted); font-size: 0.95rem; padding: 20px;">No medical consultation history recorded yet.</p>';
      return;
    }

    timeline.innerHTML = this.records.map(r => `
      <div style="padding: 18px; border-left: 4px solid var(--primary); background: var(--bg-surface); border: 1px solid var(--border-light); border-left-width: 4px; border-radius: var(--radius-md); margin-bottom: 16px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 700; color: var(--primary-dark); font-size: 1rem;">
            <i class="fa-solid fa-stethoscope"></i> ${r.record_type}
          </span>
          <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${r.created_at ? r.created_at.substring(0, 16) : ''}</span>
        </div>
        <p style="font-size: 0.92rem; color: var(--text-muted); margin-bottom: 8px;">Consulting Physician: <strong>Dr. ${r.doctor_name}</strong> (${r.hospital_name})</p>
        <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">Diagnosis / Notes:</p>
        <div style="background: var(--bg-main); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.92rem; margin-bottom: 10px;">
          ${r.diagnosis_notes}
        </div>
        ${r.vital_signs ? `<p style="font-size: 0.88rem; color: var(--secondary-dark);"><strong>Vitals Recorded:</strong> ${r.vital_signs}</p>` : ''}
        ${r.medications ? `<p style="font-size: 0.88rem; color: var(--primary-dark); margin-top: 4px;"><strong>Medications:</strong> ${r.medications}</p>` : ''}
        ${r.treatment_plan ? `<p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;"><strong>Instructions:</strong> ${r.treatment_plan}</p>` : ''}
      </div>
    `).join('');
  },

  renderDocuments() {
    const list = document.getElementById('pat-docs-container');
    if (!list) return;

    if (this.documents.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No medical certificates uploaded.</p>';
      return;
    }

    list.innerHTML = this.documents.map(d => {
      const badge = d.status === 'EXPIRED'
        ? '<span class="badge badge-expired">Expired</span>'
        : d.status === 'EXPIRING_SOON'
        ? '<span class="badge badge-expiring">Expiring Soon</span>'
        : '<span class="badge badge-valid">Valid</span>';
      const aiStatus = d.ai_verification_status || 'NOT_RUN';
      const aiBadgeClass = aiStatus === 'AI_APPROVED' ? 'badge-valid' : aiStatus === 'REJECTED' ? 'badge-expired' : 'badge-expiring';
      const aiBadgeLabel = aiStatus === 'AI_APPROVED' ? 'AI screened' : aiStatus === 'REJECTED' ? 'AI flagged' : aiStatus === 'INCONCLUSIVE' ? 'AI inconclusive' : 'Not screened';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-md); margin-bottom: 12px; box-shadow: var(--shadow-sm); flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="font-size: 1rem; color: var(--dark); margin-bottom: 4px;">${d.document_type}</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">File: <strong>${d.file_name}</strong></p>
            <small style="color: var(--text-subtle);">Issue Date: ${d.issue_date} | Review/Expiry Date: <strong>${d.review_date}</strong></small>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${badge}
            <span class="badge ${aiBadgeClass}" title="Automated image screening only; not official registry verification.">${aiBadgeLabel}${d.ai_verification_score == null ? '' : ` (${d.ai_verification_score}%)`}</span>
            <!-- 1. Send selected report to Claude AI & MATLAB Deep Learning -->
            <button class="btn btn-sm btn-primary" onclick="PatientModule.explainReport(${d.id})" title="Explain report terms with Claude AI and evaluate serious situation with MATLAB Deep Learning">
              <i class="fa-solid fa-brain"></i> AI & MATLAB Analysis
            </button>
            <!-- 2. Download report -->
            <button class="btn btn-sm btn-outline" onclick="PatientModule.downloadDocument(${d.id})">
              <i class="fa-solid fa-download"></i> Download
            </button>
            <!-- 3. Delete report (Patient can delete own reports) -->
            <button class="btn btn-sm btn-danger" onclick="PatientModule.deleteReport(${d.id}, '${d.file_name}')" title="Delete this medical report">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async loadAccessRequests() {
    try {
      const res = await window.api.get('/access-requests');
      this.accessRequests = res.requests || [];
      this.renderAccessRequests();
    } catch (err) {
      console.warn('Error loading access requests:', err);
    }
  },

  renderAccessRequests() {
    const pendingContainer = document.getElementById('pat-pending-requests-container');
    const approvedContainer = document.getElementById('pat-approved-doctors-container');
    const badgeEl = document.getElementById('nav-pending-requests-badge');

    const pending = this.accessRequests.filter(r => r.status === 'PENDING');
    const approved = this.accessRequests.filter(r => r.status === 'APPROVED');

    if (badgeEl) {
      badgeEl.textContent = pending.length;
      badgeEl.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }

    // Render Pending Requests
    if (pendingContainer) {
      if (pending.length === 0) {
        pendingContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 12px 0;">No pending doctor access requests.</p>';
      } else {
        pendingContainer.innerHTML = pending.map(r => `
          <div style="padding: 16px 20px; border: 2px solid var(--primary-light); background: #f0f9ff; border-radius: var(--radius-md); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <h4 style="color: var(--primary-dark); font-size: 1.05rem;">Dr. ${r.doctor_name}</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${r.doctor_hospital} • ${r.doctor_specialization}</p>
                <small style="color: var(--text-subtle);">Registration: ${r.doctor_reg_no || 'Verified Doctor'}</small>
              </div>
              <span class="badge badge-pending">Consent Required</span>
            </div>
            <div style="background: white; padding: 10px 14px; border-radius: 6px; font-size: 0.9rem; margin-bottom: 12px; border: 1px solid #e0f2fe;">
              <strong>Reason for Access:</strong> "${r.reason}"
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button class="btn btn-sm btn-danger" onclick="PatientModule.handleRejectRequest(${r.id}, 'Dr. ${r.doctor_name}')">
                <i class="fa-solid fa-xmark"></i> Reject Access
              </button>
              <button class="btn btn-sm btn-success" onclick="PatientModule.handleApproveRequest(${r.id}, 'Dr. ${r.doctor_name}')">
                <i class="fa-solid fa-check"></i> Approve & Share Records
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Approved Doctors (with Revoke button)
    if (approvedContainer) {
      if (approved.length === 0) {
        approvedContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No external doctors have active shared access.</p>';
      } else {
        approvedContainer.innerHTML = approved.map(r => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--bg-main); border-radius: var(--radius-md); margin-bottom: 8px;">
            <div>
              <strong>Dr. ${r.doctor_name}</strong> (${r.doctor_hospital})<br>
              <small style="color: var(--text-muted);">Access granted on: ${r.approved_at ? r.approved_at.substring(0, 10) : 'Active'}</small>
            </div>
            <button class="btn btn-sm btn-danger" onclick="PatientModule.handleRevokeRequest(${r.id}, 'Dr. ${r.doctor_name}')">
              <i class="fa-solid fa-ban"></i> Revoke Access
            </button>
          </div>
        `).join('');
      }
    }
  },

  async handleApproveRequest(requestId, doctorName) {
    if (!confirm(`Are you sure you want to grant ${doctorName} access to your medical records?`)) return;

    try {
      const res = await window.api.put(`/access-requests/${requestId}/approve`, {});
      App.showAlert(res.message, 'success');
      await this.loadAccessRequests();
    } catch (err) {
      App.showAlert(err.message, 'danger');
    }
  },

  async handleRejectRequest(requestId, doctorName) {
    if (!confirm(`Are you sure you want to decline ${doctorName}'s request?`)) return;

    try {
      const res = await window.api.put(`/access-requests/${requestId}/reject`, {});
      App.showAlert(res.message, 'info');
      await this.loadAccessRequests();
    } catch (err) {
      App.showAlert(err.message, 'danger');
    }
  },

  async handleRevokeRequest(requestId, doctorName) {
    if (!confirm(`Revoke medical record access from ${doctorName}? They will no longer be able to view your medical information.`)) return;

    try {
      const res = await window.api.put(`/access-requests/${requestId}/revoke`, {});
      App.showAlert(res.message, 'info');
      await this.loadAccessRequests();
    } catch (err) {
      App.showAlert(err.message, 'danger');
    }
  },

  async handlePatientUploadDoc(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.innerHTML = 'Uploading Document...';

    const formData = new FormData(form);
    formData.append('patientId', this.profile.id);

    try {
      const res = await window.api.postFormData('/medical-documents', formData);
      if (res.success) {
        App.showAlert(res.message || 'Medical document uploaded.', res.document && res.document.aiVerificationStatus === 'REJECTED' ? 'warning' : 'success');
        form.reset();
        App.closeModal('patient-upload-modal');
        await this.loadPatientData();
      }
    } catch (err) {
      App.showAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Upload Certificate / Report';
    }
  },

  downloadDocument(docId) {
    window.open(`/api/medical-documents/${docId}/download?token=${window.api.getToken()}`, '_blank');
  },

  /**
   * Delete Patient's Own Medical Report
   */
  async deleteReport(docId, fileName) {
    if (!confirm(`Are you sure you want to delete the medical report "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      App.showAlert(`Deleting report ${fileName}...`, 'info');
      const res = await window.api.delete(`/medical-documents/${docId}`);
      if (res.success) {
        App.showAlert(res.message || 'Medical report deleted successfully.', 'success');
        await this.loadPatientData();
      }
    } catch (err) {
      App.showAlert('Failed to delete report: ' + err.message, 'danger');
    }
  },

  /**
   * Send Selected Report Information to Claude AI & MATLAB Deep Learning
   */
  async explainReport(docId) {
    try {
      App.showAlert('Sending report to Claude AI and MATLAB Deep Learning for analysis...', 'info');

      const res = await window.api.post(`/medical-documents/${docId}/ai-explain`, {});
      if (!res.success) {
        App.showAlert('Report analysis failed.', 'danger');
        return;
      }

      const doc = res.document || {};
      const claudeHtml = App.formatMarkdown(res.claudeExplanation || '');
      const matlab = res.matlabAssessment || {};

      // Determine MATLAB Risk styling
      const isHigh = matlab.riskLevel === 'High Risk';
      const isMod  = matlab.riskLevel === 'Moderate' || matlab.riskLevel === 'Moderate Risk';
      const riskColor = isHigh ? '#dc2626' : isMod ? '#d97706' : '#059669';
      const riskBg    = isHigh ? '#fef2f2' : isMod ? '#fffbeb' : '#f0fdf4';
      const riskBorder= isHigh ? '#f87171' : isMod ? '#fcd34d' : '#86efac';

      const modalBody = document.getElementById('report-ai-modal-content');
      if (modalBody) {
        modalBody.innerHTML = `
          <!-- Header info -->
          <div style="margin-bottom: 20px; padding: 14px 18px; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="color: var(--primary-dark); margin-bottom: 2px;">
                  <i class="fa-solid fa-file-medical"></i> ${doc.documentType || 'Medical Report'}
                </h3>
                <small style="color: var(--text-muted);">File: <strong>${doc.fileName}</strong> | Valid: ${doc.issueDate} to ${doc.reviewDate}</small>
              </div>
              <span class="badge badge-valid">AI Analyzed</span>
            </div>
          </div>

          <!-- Section 1: MATLAB Deep Learning Serious Situation & Risk Assessment -->
          <div style="margin-bottom: 24px; padding: 20px; background: ${riskBg}; border: 2px solid ${riskBorder}; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="background: ${riskColor}; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                  <i class="fa-solid fa-microchip"></i>
                </span>
                <div>
                  <h4 style="color: ${riskColor}; font-size: 1.1rem; margin: 0;">
                    MATLAB Deep Learning Serious-Situation Flag
                  </h4>
                  <small style="color: var(--text-muted);">Architecture: 1D-CNN + BiLSTM Neural Network</small>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge" style="background: ${riskColor}; color: white; font-size: 0.92rem; padding: 6px 14px;">
                  ${matlab.riskLevel || 'Moderate'}
                </span>
              </div>
            </div>

            <!-- Risk Score Gauge / Bar -->
            <div style="margin: 14px 0 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">
                <span>Deep Learning Risk Score</span>
                <span style="color: ${riskColor}; font-size: 1rem;">${(matlab.riskScore * 100).toFixed(0)}% (${matlab.riskScore || '0.00'})</span>
              </div>
              <div style="background: #e2e8f0; height: 10px; border-radius: 999px; overflow: hidden;">
                <div style="background: ${riskColor}; height: 100%; width: ${Math.min(matlab.riskScore * 100, 100)}%; transition: width 0.6s ease;"></div>
              </div>
            </div>

            <!-- Safety Recommendation Note -->
            <div style="background: white; padding: 12px 16px; border-radius: var(--radius-sm); border-left: 4px solid ${riskColor}; margin-top: 12px;">
              <strong><i class="fa-solid fa-triangle-exclamation"></i> Safety Recommendation:</strong>
              <span style="color: var(--dark); font-size: 0.92rem; display: block; margin-top: 4px;">
                ${matlab.recommendation || 'Potential risk detected — professional medical evaluation recommended.'}
              </span>
            </div>
          </div>

          <!-- Section 2: Claude AI Plain-Language Report & Reference Ranges Explanation -->
          <div style="padding: 20px; background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 10px;">
              <span style="background: #d97706; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-robot"></i>
              </span>
              <div>
                <h4 style="margin: 0; color: var(--dark);">Claude AI: Medical Terms & Reference Ranges Explanation</h4>
                <small style="color: var(--text-muted);">Plain language clinical interpretation</small>
              </div>
            </div>

            <div style="line-height: 1.65; color: var(--text-main); font-size: 0.95rem;">
              ${claudeHtml}
            </div>
          </div>
        `;

        App.openModal('report-ai-modal');
      }
    } catch (err) {
      App.showAlert('AI Report Analysis failed: ' + err.message, 'danger');
    }
  }
};

window.PatientModule = PatientModule;
