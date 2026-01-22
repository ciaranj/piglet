require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const db = require('./services/db');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const siteResolver = require('./middleware/site-resolver');
const siteAuth = require('./middleware/site-auth');
const staticServe = require('./middleware/static-serve');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for static docs that may have inline scripts
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.COOKIE_SECRET || 'development-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24 hours
  }
}));

// Initialize database
db.initialize();

// Health check routes (no auth required)
app.use('/health', healthRoutes);
app.use('/api/status', healthRoutes);

// Auth routes
app.use('/_auth', authRoutes);

// Admin portal API routes (requires Entra ID auth)
app.use('/_pigsty/api', adminRoutes);

// Serve admin portal static files
app.use('/_pigsty', express.static(path.join(__dirname, '../dist/piglet/browser')));

// Admin portal SPA fallback
app.get('/_pigsty/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/piglet/browser/index.html'));
});

// Site resolution and authentication for documentation sites
app.use(siteResolver);
app.use(siteAuth);
app.use(staticServe);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Piglet server running on port ${PORT}`);
  console.log(`Data path: ${process.env.DATA_PATH || './data'}`);
});

module.exports = app;
