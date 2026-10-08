/**
 * AI Medical Chatbot & Clinical Intelligence Module
 * 
 * ChatGPT-Style Conversational Experience connecting with Patient Emotion:
 * - Powered by Claude AI & MATLAB Affective Computing (analyze_emotion.m)
 * - Tailored modes: Compassionate Patient Empathy vs. Doctor Clinical AI Copilot
 * - Multi-turn conversational memory with New Chat session support
 * - Auto-expanding multiline input with Enter-to-send
 */

const ChatModule = {
  sessionId: 'session_' + Date.now(),
  historyLoaded: false,
  currentEmotion: null,

  init() {
    this.bindEvents();
  },

  setupRoleView() {
    const user = window.Auth ? Auth.getUser() : null;
    const isDoctor = user && user.role === 'doctor';

    const titleEl = document.getElementById('chat-header-title');
    const subtitleEl = document.getElementById('chat-header-subtitle');
    const avatarEl = document.getElementById('chat-header-avatar');
    const inputEl = document.getElementById('chat-input-field');

    if (isDoctor) {
      if (titleEl) titleEl.textContent = 'Clinical AI Copilot (Doctor Mode)';
      if (subtitleEl) {
        subtitleEl.innerHTML = '<i class="fa-solid fa-circle" style="color: #10b981; font-size: 8px;"></i> Evidence-Based Clinical Reasoning & Pharmacology Screening';
      }
      if (avatarEl) {
        avatarEl.innerHTML = '<i class="fa-solid fa-user-doctor"></i>';
        avatarEl.style.background = 'linear-gradient(135deg, #059669, #047857)';
      }
      if (inputEl) {
        inputEl.placeholder = 'Consult Clinical Copilot (e.g., "Review differential diagnosis for atypical chest pain" or "Screen drug interactions")...';
      }
    } else {
      if (titleEl) titleEl.textContent = 'AI Health Companion';
      if (subtitleEl) {
        subtitleEl.innerHTML = '<i class="fa-solid fa-circle" style="color: #10b981; font-size: 8px;"></i> Powered by Claude AI & MATLAB Affective Empathy Engine';
      }
      if (avatarEl) {
        avatarEl.innerHTML = '<i class="fa-solid fa-brain"></i>';
        avatarEl.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      }
      if (inputEl) {
        inputEl.placeholder = 'Message your AI Health Companion... (Press Enter to send, Shift+Enter for new line)';
      }
    }
  },

  bindEvents() {
    const chatForm = document.getElementById('chat-form');
    const textarea = document.getElementById('chat-input-field');

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => this.handleSendMessage(e));
    }

    if (textarea) {
      // Auto-resize textarea height
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
      });

      // Enter to send, Shift+Enter for newline
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (chatForm) {
            chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
          }
        }
      });
    }

    const reportForm = document.getElementById('report-analysis-form');
    if (reportForm) {
      reportForm.addEventListener('submit', (e) => this.handleAnalyzeReport(e));
    }
  },

  startNewChat() {
    this.sessionId = 'session_' + Date.now();
    this.currentEmotion = null;

    const container = document.getElementById('chat-messages-container');
    if (container) container.innerHTML = '';

    const emotionBadge = document.getElementById('chat-live-emotion-badge');
    if (emotionBadge) emotionBadge.style.display = 'none';

    const emergencyBox = document.getElementById('chat-emergency-banner');
    if (emergencyBox) {
      emergencyBox.textContent = '';
      emergencyBox.style.display = 'none';
    }

    this.setupRoleView();
    this.showGreetingMessage();

    const input = document.getElementById('chat-input-field');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
      input.focus();
    }
  },

  showGreetingMessage() {
    const user = window.Auth ? Auth.getUser() : null;
    const isDoctor = user && user.role === 'doctor';

    if (isDoctor) {
      this.appendMessage(
        `### 🩺 Welcome, Doctor.\nClinical AI Copilot is online and ready to assist with:\n\n* **Differential Diagnosis Exploration:** Evidence-graded symptom evaluation.\n* **Pharmacology & Cross-Interactions:** Renal/hepatic dosing & contraindication alerts.\n* **SOAP Note Drafting:** Structured clinical documentation.\n\n*How can I assist your clinical rounds today?*`,
        'ai',
        false,
        null,
        'Clinical AI Copilot'
      );
    } else {
      const name = user && user.name ? user.name.split(' ')[0] : 'there';
      this.appendMessage(
        `### 👋 Hello ${name}, I am your AI Health Companion.\nI'm here to listen, support you through any health worries or symptoms you are experiencing, and explain medical reports or health concepts in simple, soothing words.\n\n*Take a deep breath and tell me: how are you feeling today?*`,
        'ai',
        false,
        null,
        'Claude & MATLAB Health Companion'
      );
    }
  },

  async loadChatHistory() {
    this.setupRoleView();
    if (this.historyLoaded) return;

    try {
      const res = await window.api.get('/chat/history');
      const messagesContainer = document.getElementById('chat-messages-container');
      if (!messagesContainer) return;

      const history = res.history || [];
      if (history.length > 0) {
        messagesContainer.innerHTML = '';
        history.forEach(item => {
          this.appendMessage(item.message, 'user');
          this.appendMessage(item.response, 'ai', item.is_emergency);
        });
      } else {
        this.showGreetingMessage();
      }
      this.historyLoaded = true;
    } catch (err) {
      console.warn('Could not load chat history:', err);
      this.showGreetingMessage();
    }
  },

  async handleSendMessage(e) {
    e.preventDefault();
    const form = e.target;
    const input = form.message || document.getElementById('chat-input-field');
    const text = input ? input.value.trim() : '';
    const submitBtn = document.getElementById('chat-send-btn');

    if (!text) return;

    // Display user message immediately in ChatGPT style
    this.appendMessage(text, 'user');
    input.value = '';
    input.style.height = 'auto';

    // Show smooth typing indicator
    const typingId = this.showTypingIndicator();
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await window.api.post('/ai/chat', {
        message: text,
        sessionId: this.sessionId
      });

      this.removeTypingIndicator(typingId);

      // Emergency alert handling
      if (res.isEmergency) {
        this.showEmergencyAlert(res.emergencyAlert);
      }

      // Update real-time emotion badge from MATLAB analysis
      if (res.emotion) {
        this.updateEmotionBadge(res.emotion);
      }

      this.appendMessage(
        res.message,
        'ai',
        res.isEmergency,
        res.emotion,
        res.modelUsed || 'Claude AI'
      );
    } catch (err) {
      this.removeTypingIndicator(typingId);
      this.appendMessage('⚠️ Error: ' + (err.message || 'Unable to connect to AI Medical service.'), 'ai');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (input) input.focus();
    }
  },

  updateEmotionBadge(emotion) {
    this.currentEmotion = emotion;
    const badge = document.getElementById('chat-live-emotion-badge');
    const textSpan = document.getElementById('chat-live-emotion-text');

    if (badge && textSpan && emotion.primaryEmotion) {
      const scorePct = Math.round((emotion.distressScore || 0) * 100);
      textSpan.textContent = `Empathy Active: ${emotion.primaryEmotion} (${scorePct}% distress)`;
      badge.style.display = 'inline-flex';

      // Subtle color variation depending on distress level
      if (emotion.distressScore >= 0.7) {
        badge.style.background = '#fef2f2';
        badge.style.color = '#dc2626';
        badge.style.borderColor = '#fca5a5';
      } else if (emotion.distressScore >= 0.4) {
        badge.style.background = '#fffbeb';
        badge.style.color = '#d97706';
        badge.style.borderColor = '#fcd34d';
      } else {
        badge.style.background = '#eff6ff';
        badge.style.color = '#0284c7';
        badge.style.borderColor = '#bfdbfe';
      }
    }
  },

  appendMessage(text, sender, isEmergency = false, emotion = null, modelLabel = null) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const user = window.Auth ? Auth.getUser() : null;
    const isDoctor = user && user.role === 'doctor';

    const row = document.createElement('div');
    row.className = `chat-message-row ${sender}`;

    // Avatar element
    const avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';

    if (sender === 'user') {
      avatar.innerHTML = isDoctor ? '<i class="fa-solid fa-stethoscope"></i>' : '<i class="fa-solid fa-user"></i>';
    } else {
      avatar.innerHTML = isDoctor ? '<i class="fa-solid fa-user-doctor"></i>' : '<i class="fa-solid fa-brain"></i>';
      if (isDoctor) avatar.style.background = 'linear-gradient(135deg, #059669, #047857)';
    }

    // Message Body
    const body = document.createElement('div');
    body.className = 'chat-msg-body';

    // Sender Label
    const senderLabel = document.createElement('div');
    senderLabel.className = 'chat-msg-sender';
    if (sender === 'user') {
      senderLabel.textContent = isDoctor ? 'You (Physician)' : 'You';
    } else {
      senderLabel.textContent = modelLabel || (isDoctor ? 'Clinical AI Copilot' : 'Claude & MATLAB Empathy Engine');
    }
    body.appendChild(senderLabel);

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${sender}`;

    if (sender === 'ai') {
      let content = App.formatMarkdown(text);
      if (isEmergency) {
        bubble.innerHTML = `
          <div class="emergency-box" style="margin-bottom: 12px; padding: 12px 16px;">
            <h4 style="display: flex; align-items: center; gap: 8px; font-size: 1rem; margin: 0 0 6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> CRITICAL EMERGENCY DETECTED
            </h4>
            <p style="font-size: 0.88rem; margin: 0;">Please seek immediate emergency medical care (call 112 / 911 or visit the nearest emergency room). Do not delay!</p>
          </div>
          ${content}
        `;
      } else {
        bubble.innerHTML = content;
      }
    } else {
      bubble.textContent = text;
    }
    body.appendChild(bubble);

    // Optional Emotion Pill beneath AI response
    if (sender === 'ai' && emotion && emotion.primaryEmotion && !isDoctor) {
      const pill = document.createElement('div');
      pill.className = 'chat-emotion-pill';
      const pct = Math.round((emotion.distressScore || 0) * 100);
      pill.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> Emotion Tuned: <strong>${emotion.primaryEmotion}</strong> (${pct}% distress)`;
      body.appendChild(pill);
    }

    row.appendChild(avatar);
    row.appendChild(body);

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  },

  showTypingIndicator() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return null;

    const id = 'typing_' + Date.now();
    const row = document.createElement('div');
    row.id = id;
    row.className = 'chat-message-row ai';

    const avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';
    avatar.innerHTML = '<i class="fa-solid fa-brain"></i>';

    const body = document.createElement('div');
    body.className = 'chat-msg-body';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble ai';
    bubble.style.padding = '12px 18px';
    bubble.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary); margin-right:8px;"></i> Reflecting with Claude AI & MATLAB emotion model...';

    body.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(body);

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return id;
  },

  removeTypingIndicator(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  showEmergencyAlert(alertText) {
    const alertBox = document.getElementById('chat-emergency-banner');
    if (alertBox) {
      alertBox.textContent = alertText;
      alertBox.style.display = 'block';
    }
  },

  // Medical Report Parameter Analyzer
  async handleAnalyzeReport(e) {
    e.preventDefault();
    const form = e.target;
    const text = form.reportText.value.trim();
    const docType = form.documentType.value;
    const btn = form.querySelector('button[type="submit"]');
    const resultBox = document.getElementById('report-analysis-results');

    if (!text) {
      App.showAlert('Please provide or paste report text to analyze.', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing with Claude AI & MATLAB Deep Learning...';

    try {
      const res = await window.api.post('/ai/analyze-report', {
        reportText: text,
        documentType: docType
      });

      if (res.success) {
        resultBox.style.display = 'block';

        const matlab = res.matlabAssessment || {};
        const isHigh = matlab.riskLevel === 'High Risk';
        const isMod  = matlab.riskLevel === 'Moderate' || matlab.riskLevel === 'Moderate Risk';
        const riskColor = isHigh ? '#dc2626' : isMod ? '#d97706' : '#059669';
        const riskBg    = isHigh ? '#fef2f2' : isMod ? '#fffbeb' : '#f0fdf4';
        const riskBorder= isHigh ? '#f87171' : isMod ? '#fcd34d' : '#86efac';

        resultBox.innerHTML = `
          <!-- MATLAB Deep Learning Risk Card -->
          <div style="margin-bottom: 20px; padding: 18px; background: ${riskBg}; border: 2px solid ${riskBorder}; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: ${riskColor}; font-size: 1.05rem;">
                <i class="fa-solid fa-microchip"></i> MATLAB Deep Learning Risk Flag: ${matlab.riskLevel || 'Moderate'}
              </strong>
              <span class="badge" style="background: ${riskColor}; color: white;">
                Risk Score: ${(matlab.riskScore * 100).toFixed(0)}% (${matlab.riskScore || '0.00'})
              </span>
            </div>
            <div style="background: white; padding: 10px 14px; border-radius: var(--radius-sm); border-left: 4px solid ${riskColor};">
              <strong>Recommendation:</strong> ${matlab.recommendation || 'Potential risk detected — professional medical evaluation recommended.'}
            </div>
          </div>

          <!-- Claude AI Simple Language Explanation -->
          <div style="margin-top: 14px;">
            ${App.formatMarkdown(res.analysis)}
          </div>
        `;
      }
    } catch (err) {
      App.showAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Analyze Clinical Report';
    }
  },

  loadSampleReport() {
    const textEl = document.getElementById('report-input-text');
    if (textEl) {
      textEl.value = `COMPREHENSIVE METABOLIC & LIPID PANEL
Patient: Rahul Verma | Ref By: Dr. Rajesh Sharma
Date: 2026-04-10

- Fasting Blood Sugar: 126 mg/dL (Normal Range: 70 - 99 mg/dL) [HIGH]
- HbA1c: 6.8% (Normal: < 5.7%) [HIGH]
- Total Cholesterol: 215 mg/dL (Desirable: < 200 mg/dL) [BORDERLINE HIGH]
- Triglycerides: 165 mg/dL (Normal: < 150 mg/dL) [HIGH]
- HDL Cholesterol: 48 mg/dL (Normal: > 40 mg/dL) [NORMAL]
- LDL Cholesterol: 134 mg/dL (Optimal: < 100 mg/dL) [HIGH]
- Serum Creatinine: 0.9 mg/dL (Normal: 0.7 - 1.3 mg/dL) [NORMAL]
- Hemoglobin: 14.2 g/dL (Normal: 13.8 - 17.2 g/dL) [NORMAL]`;
    }
  }
};

window.ChatModule = ChatModule;
