/**
 * AI Medical Chat & Clinical Intelligence Controller
 */
const db = require('../config/db');
const {
  processChatMessage,
  analyzeMedicalReport,
  generateDoctorClinicalSummary
} = require('../services/aiService');
const { calculateAge, getClientIp } = require('../utils/helpers');
const { logAudit } = require('../utils/auditLogger');

/**
 * Send Message to AI Medical Chatbot
 */
async function sendMessage(req, res) {
  try {
    const { message, sessionId = 'default-session' } = req.body;
    const user = req.user;
    const clientIp = getClientIp(req);

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.'
      });
    }

    // Prepare patient or doctor context
    let patientContext = null;
    let doctorContext = null;
    if (user.role === 'patient') {
      const p = await db.getOne('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (p) {
        patientContext = {
          ...p,
          age: calculateAge(p.date_of_birth)
        };
      }
    } else if (user.role === 'doctor') {
      doctorContext = await db.getOne('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
    }

    // Fetch recent multi-turn conversation history for contextual ChatGPT-style continuity
    const recentRows = await db.query(`
      SELECT message, response
      FROM chatbot_conversations
      WHERE user_id = ? AND session_id = ?
      ORDER BY id DESC
      LIMIT 8
    `, [user.id, sessionId]);
    const conversationHistory = (recentRows || []).reverse();

    // Process through AI Medical Safety Engine & MATLAB Emotion Analysis
    const result = await processChatMessage({
      message: message.trim(),
      patientContext,
      doctorContext,
      isDoctor: user.role === 'doctor',
      conversationHistory
    });

    // Save to conversation history
    await db.query(`
      INSERT INTO chatbot_conversations (
        user_id, session_id, message, response, is_emergency, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `, [
      user.id,
      sessionId,
      message.trim(),
      result.response,
      result.isEmergency ? 1 : 0
    ]);

    // If emergency detected, record in audit log
    if (result.isEmergency) {
      await logAudit({
        userId: user.id,
        action: 'AI_EMERGENCY_TRIGGERED',
        patientId: patientContext ? patientContext.id : null,
        details: `Emergency symptoms flagged in message: "${message.substring(0, 100)}"`,
        ipAddress: clientIp
      });
    }

    return res.json({
      success: true,
      message: result.response,
      emotion: result.emotion || null,
      modelUsed: result.modelUsed || 'Claude AI & MATLAB Emotion Engine',
      isEmergency: result.isEmergency,
      emergencyAlert: result.emergencyAlert || null
    });
  } catch (err) {
    console.error('[AI Chat Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'AI assistant service encountered an error.'
    });
  }
}

/**
 * Analyze Uploaded or Pasted Medical Report
 */
async function analyzeReport(req, res) {
  try {
    const { reportText, documentType = 'Lab Report' } = req.body;
    const user = req.user;

    if (!reportText || !reportText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide report text or parameters for analysis.'
      });
    }

    let patientContext = null;
    if (user.role === 'patient') {
      const p = await db.getOne('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (p) {
        patientContext = {
          ...p,
          age: calculateAge(p.date_of_birth)
        };
      }
    }

    const result = await analyzeMedicalReport({
      reportText: reportText.trim(),
      documentType,
      patientContext
    });

    await logAudit({
      userId: user.id,
      action: 'AI_REPORT_ANALYZED',
      patientId: patientContext ? patientContext.id : null,
      details: `${user.role.toUpperCase()} ${user.username} requested analysis for ${documentType} (MATLAB Risk: ${result.matlabAssessment?.riskLevel || 'Evaluated'})`,
      ipAddress: getClientIp(req)
    });

    return res.json({
      success: true,
      analysis: result.analysis,
      matlabAssessment: result.matlabAssessment
    });
  } catch (err) {
    console.error('[AI Report Analysis Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze medical report.'
    });
  }
}

/**
 * Dedicated MATLAB Deep Learning Serious Situation Detection Endpoint
 */
async function getMatlabRiskAnalysis(req, res) {
  try {
    const { predictRisk } = require('../services/matlabService');
    const result = await predictRisk(req.body);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[MATLAB Risk Analysis Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'MATLAB risk analysis error: ' + err.message
    });
  }
}

/**
 * Doctor AI Clinical Summarizer & SOAP Draft Generator
 */
async function getDoctorClinicalSummary(req, res) {
  try {
    const patientId = req.params.patientId;
    const doctor = req.doctor;

    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: 'Only registered medical doctors can generate clinical summaries.'
      });
    }

    const patient = await db.getOne('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.'
      });
    }

    const medicalRecords = await db.query(
      'SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5',
      [patientId]
    );

    const documents = await db.query(
      'SELECT * FROM medical_documents WHERE patient_id = ? ORDER BY id DESC LIMIT 5',
      [patientId]
    );

    const result = await generateDoctorClinicalSummary({
      patient,
      medicalRecords,
      documents
    });

    await logAudit({
      userId: req.user.id,
      action: 'AI_CLINICAL_SUMMARY_GENERATED',
      patientId: patient.id,
      details: `Dr. ${doctor.name} generated AI clinical SOAP summary for Patient ${patient.name}`,
      ipAddress: getClientIp(req)
    });

    return res.json({
      success: true,
      summary: result.summary
    });
  } catch (err) {
    console.error('[Doctor AI Summary Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate clinical summary.'
    });
  }
}

/**
 * Get User Chatbot Conversation History
 */
async function getChatHistory(req, res) {
  try {
    const userId = req.user.id;
    const history = await db.query(`
      SELECT id, session_id, message, response, is_emergency, created_at
      FROM chatbot_conversations
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 100
    `, [userId]);

    return res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history.'
    });
  }
}

module.exports = {
  sendMessage,
  analyzeReport,
  getMatlabRiskAnalysis,
  getDoctorClinicalSummary,
  getChatHistory
};
