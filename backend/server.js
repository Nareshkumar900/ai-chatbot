/**
 * AI Medical Doctor-Patient Management System
 * Main Express Application Server
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDB } = require('./config/db');
const { startExpiryMonitor } = require('./services/expiryChecker');

// Route imports
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const documentRoutes = require('./routes/documentRoutes');
const accessRequestRoutes = require('./routes/accessRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false // Allow local styles, CDNs, inline scripts for modern SPA
  })
);
app.use(cors());

// Rate Limiter to protect from brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again later.'
  }
});
app.use('/api/', apiLimiter);

// Logger & Body Parsers
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets: Serve Frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medical-documents', documentRoutes);
app.use('/api/access-requests', accessRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', chatRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'AI Medical Doctor-Patient Management Platform',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application (SPA) fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File Upload Error: ${err.message}`
    });
  }
  return res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server & Services
async function startServer() {
  try {
    // 1. Initialize Database
    await initDB();

    // 2. Start Background Certificate Expiry Monitor
    startExpiryMonitor();

    // 3. Listen on port with graceful EADDRINUSE handling
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🏥 AI Medical Doctor-Patient Management System`);
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`🩺 Doctor & Patient Portals Ready`);
      console.log(`🔒 Strict Backend Data Isolation Enforced`);
      console.log(`🤖 AI Medical Assistant & Safety Engine Active`);
      console.log(`====================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`\nℹ️ Notice: The server is already running and active on http://localhost:${PORT}`);
        console.log(`🌐 You can open http://localhost:${PORT}/ in your browser.\n`);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
