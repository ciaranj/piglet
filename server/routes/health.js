const express = require('express');
const router = express.Router();
const db = require('../services/db');
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || './data';

router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  try {
    // Check database
    const dbCheck = db.get('SELECT 1 as ok');
    const dbOk = dbCheck && dbCheck.ok === 1;

    // Check storage
    const sitesPath = path.join(DATA_PATH, 'sites');
    const uploadsPath = path.join(DATA_PATH, 'uploads');
    const storageOk = fs.existsSync(DATA_PATH);

    // Get counts
    const siteCount = db.get('SELECT COUNT(*) as count FROM sites');
    const userCount = db.get('SELECT COUNT(*) as count FROM users');

    res.json({
      status: dbOk && storageOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'error',
        storage: storageOk ? 'ok' : 'error'
      },
      stats: {
        sites: siteCount?.count || 0,
        users: userCount?.count || 0
      },
      paths: {
        data: DATA_PATH,
        sites: sitesPath,
        uploads: uploadsPath
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
