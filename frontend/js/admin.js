/**
 * Administrator Module
 * - Doctor Registration Management
 * - AI Forensic License & Certificate Authenticity Verification (Detect Real vs Fake)
 * - Patient Registration Oversight
 * - System Metrics & Tamper-Resistant Security Audit Trail
 */

const AdminModule = {
  doctors: [],
  patients: [],
  logs: [],
  aiResults: {},

  async init() {
    await this.loadAdminStats();
    await this.loadDoctors();
    await this.loadPatients();
    await this.loadAuditLogs();
  },

  async loadAdminStats() {
    try {
      const res = await window.api.get('/admin/stats');
      const s = res.stats;

      document.getElementById('stat-admin-total-docs').textContent = s.totalDoctors;
      document.getElementById('stat-admin-verified-docs').textContent = s.verifiedDoctors;
      document.getElementById('stat-admin-pending-docs').textContent = s.pendingDoctors;
      document.getElementById('stat-admin-total-patients').textContent = s.totalPatients;
      document.getElementById('stat-admin-total-records').textContent = s.totalRecords;
      document.getElementById('stat-admin-total-docs-count').textContent = s.totalDocuments;
      document.getElementById('stat-admin-expiring-certs').textContent = s.expiringCertificates;
      document.getElementById('stat-admin-audit-events').textContent = s.totalAuditEvents;
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  },

  async loadDoctors() {
    try {
      const res = await window.api.get('/admin/doctors');
      this.doctors = res.doctors || [];
      this.renderDoctorsTable();
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  },

  renderDoctorsTable() {
    const tbody = document.getElementById('admin-doctors-tbody');
    if (!tbody) return;

    if (this.doctors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No doctors registered.</td></tr>';
      return;
    }

    tbody.innerHTML = this.doctors.map(d => {
      const isVerified = Boolean(d.is_verified);
      const statusBadge = isVerified
        ? '<span class="badge badge-valid"><i class="fa-solid fa-check-circle"></i> Verified</span>'
        : '<span class="badge badge-pending"><i class="fa-solid fa-hourglass-half"></i> Pending Review</span>';

      const aiCard = this.aiResults[d.id] ? `
        <div style="margin-top: 10px; padding: 14px 18px; background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid ${this.aiResults[d.id].riskLevel === 'HIGH' ? '#ef4444' : '#10b981'}; border-radius: var(--radius-sm); font-size: 0.88rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
            <strong style="color: ${this.aiResults[d.id].riskLevel === 'HIGH' ? '#dc2626' : '#059669'}; font-size: 0.95rem;">
              <i class="fa-solid fa-robot"></i> AI Authenticity Verdict: ${this.aiResults[d.id].verdict}
            </strong>
            <span class="badge ${this.aiResults[d.id].riskLevel === 'HIGH' ? 'badge-expired' : 'badge-valid'}">
              Confidence: ${this.aiResults[d.id].confidence} | Risk: ${this.aiResults[d.id].riskLevel}
            </span>
          </div>
          <div style="line-height: 1.5; color: var(--text-main);">
            ${App.formatMarkdown(this.aiResults[d.id].analysis)}
          </div>
        </div>
      ` : '';

      return `
        <tr>
          <td>
            <strong>${d.name}</strong><br>
            <small style="color: var(--text-muted);">${d.qualification}</small>
          </td>
          <td>${d.specialization}</td>
          <td>${d.hospital}</td>
          <td><code>${d.medical_registration_number}</code></td>
          <td>${d.experience} years</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <!-- 1. AI Authenticity Analysis Button -->
              <button class="btn btn-sm btn-secondary" onclick="AdminModule.runAiLicenseAnalysis(${d.id})" title="Run AI Forensics to Detect Real vs Fake License">
                <i class="fa-solid fa-wand-magic-sparkles"></i> AI Authenticity Check
              </button>

              <!-- 2. View Uploaded Document Link -->
              ${d.license_document ? `
                <a href="/api/admin/doctors/${d.id}/license?token=${window.api.getToken()}" target="_blank" class="btn btn-sm btn-outline" title="Inspect License Document">
                  <i class="fa-solid fa-file-pdf"></i> Inspect License
                </a>
              ` : ''}

              <!-- 3. Approve / Revoke Action Button -->
              <button class="btn btn-sm ${isVerified ? 'btn-danger' : 'btn-success'}" onclick="AdminModule.toggleDoctorVerification(${d.id}, ${!isVerified})">
                ${isVerified ? '<i class="fa-solid fa-ban"></i> Revoke' : '<i class="fa-solid fa-check"></i> Approve Doctor'}
              </button>
            </div>
            ${aiCard}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Run AI Authenticity Analysis on Doctor's Registration & License
   */
  async runAiLicenseAnalysis(doctorId) {
    try {
      App.showAlert('Running AI Forensic Authenticity Analysis on registration and license...', 'info');
      const res = await window.api.post(`/admin/doctors/${doctorId}/analyze-license`, {});
      if (res.success) {
        this.aiResults[doctorId] = {
          verdict: res.verdict,
          confidence: res.confidence,
          riskLevel: res.riskLevel,
          analysis: res.analysis
        };
        this.renderDoctorsTable();
        App.showAlert(`AI Analysis Completed: License evaluated as ${res.verdict} (Confidence: ${res.confidence})`, 'success');
      }
    } catch (err) {
      App.showAlert('AI Analysis failed: ' + err.message, 'danger');
    }
  },

  async toggleDoctorVerification(doctorId, newStatus) {
    try {
      const res = await window.api.put(`/admin/doctors/${doctorId}/verify`, { isVerified: newStatus });
      App.showAlert(res.message, 'success');
      await this.loadDoctors();
      await this.loadAdminStats();
    } catch (err) {
      App.showAlert(err.message, 'danger');
    }
  },

  async loadPatients() {
    try {
      const res = await window.api.get('/patients');
      this.patients = res.patients || [];
      this.renderPatientsTable();
    } catch (err) {
      console.warn('Failed to load patient registrations:', err);
    }
  },

  renderPatientsTable() {
    const tbody = document.getElementById('admin-patients-tbody');
    if (!tbody) return;

    if (this.patients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No patients enrolled in system.</td></tr>';
      return;
    }

    tbody.innerHTML = this.patients.map(p => `
      <tr>
        <td>
          <strong>${p.name}</strong><br>
          <small style="color: var(--text-muted);">${p.gender}, ${p.age || 'N/A'} yrs</small>
        </td>
        <td><code>${p.medical_id}</code></td>
        <td><span class="badge" style="background:#e2e8f0;">${p.blood_group || 'N/A'}</span></td>
        <td>${p.registered_by_doctor_name || 'Dr. Sharma'}</td>
        <td>${p.email}</td>
        <td><small style="color: var(--text-muted);">${p.created_at ? p.created_at.substring(0, 10) : ''}</small></td>
      </tr>
    `).join('');
  },

  async loadAuditLogs() {
    try {
      const res = await window.api.get('/admin/audit-logs?limit=50');
      this.logs = res.logs || [];
      this.renderAuditLogsTable();
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  },

  renderAuditLogsTable() {
    const tbody = document.getElementById('admin-audit-tbody');
    if (!tbody) return;

    if (this.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No audit logs recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = this.logs.map(l => {
      const isSecurityAlert = l.action.includes('BLOCKED') || l.action.includes('FAILED');
      const isAiAudit = l.action.includes('AI_');
      return `
        <tr style="${isSecurityAlert ? 'background: #fff1f2;' : isAiAudit ? 'background: #f0fdf4;' : ''}">
          <td><small>${l.timestamp ? l.timestamp.substring(0, 19) : ''}</small></td>
          <td>
            <span class="badge ${isSecurityAlert ? 'badge-expired' : isAiAudit ? 'badge-valid' : 'badge-primary-custodian'}">
              ${l.action}
            </span>
          </td>
          <td>${l.username ? `<strong>${l.username}</strong> (${l.role})` : 'System'}</td>
          <td><small>${l.details || ''}</small></td>
          <td><code>${l.ip_address || '127.0.0.1'}</code></td>
        </tr>
      `;
    }).join('');
  }
};

window.AdminModule = AdminModule;
