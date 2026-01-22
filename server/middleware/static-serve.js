const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const storage = require('../services/storage');
const db = require('../services/db');

const DATA_PATH = process.env.DATA_PATH || './data';

/**
 * Static file serving middleware for documentation sites
 * Serves files from the active version of the resolved site
 */
function staticServe(req, res, next) {
  // If no site resolved, skip
  if (!req.site) {
    return next();
  }

  // Get the active content version for this site
  const activeVersion = db.getActiveContentVersion(req.site.id);

  if (!activeVersion) {
    return res.status(404).send('No content available for this site');
  }

  // Get the version directory path
  const versionPath = storage.getVersionDirectory(req.sitePath, activeVersion.id);

  // Construct the full file path
  let filePath = path.join(versionPath, req.remainingPath);

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(versionPath)) {
    return res.status(403).send('Access denied');
  }

  // Check if it's a directory - redirect to add trailing slash for correct relative URLs
  const stats = fs.statSync(normalizedPath, { throwIfNoEntry: false });

  if (stats?.isDirectory()) {
    // Redirect to trailing slash if not present (fixes relative URL resolution)
    if (!req.originalUrl.endsWith('/')) {
      return res.redirect(301, req.originalUrl + '/');
    }

    const indexPath = path.join(normalizedPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      return res.status(404).send('Not found');
    }
  } else if (!fs.existsSync(normalizedPath)) {
    // Try adding .html extension
    if (!normalizedPath.endsWith('.html') && fs.existsSync(normalizedPath + '.html')) {
      filePath = normalizedPath + '.html';
    } else {
      return res.status(404).send('Not found');
    }
  }

  // Determine content type
  const contentType = mime.lookup(filePath) || 'application/octet-stream';

  // Set caching headers for static content
  const cacheMaxAge = process.env.STATIC_CACHE_MAX_AGE || 3600; // 1 hour default
  res.set({
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${cacheMaxAge}`,
    'X-Content-Type-Options': 'nosniff'
  });

  // Stream the file
  const readStream = fs.createReadStream(filePath);
  readStream.on('error', (err) => {
    console.error('Error reading file:', err);
    res.status(500).send('Error reading file');
  });

  readStream.pipe(res);
}

module.exports = staticServe;
