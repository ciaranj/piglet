const db = require('../services/db');

/**
 * Site resolver middleware
 * Resolves incoming requests to the appropriate site based on path
 * Uses longest-match-first strategy (most specific site wins)
 */
async function siteResolver(req, res, next) {
  // Skip reserved paths
  if (req.path.startsWith('/_pigsty') ||
      req.path.startsWith('/_auth') ||
      req.path.startsWith('/_health')) {
    return next('route');
  }

  const pathParts = req.path.split('/').filter(Boolean);

  // If no path parts, try root site
  if (pathParts.length === 0) {
    const rootSite = db.getSiteByPath('/');
    if (rootSite) {
      req.site = rootSite;
      req.sitePath = '/';
      req.remainingPath = '/index.html';
      return next();
    }
    return res.status(404).send('No site configured');
  }

  // Try longest match first (most specific site wins)
  for (let i = pathParts.length; i > 0; i--) {
    const candidatePath = '/' + pathParts.slice(0, i).join('/');
    const site = db.getSiteByPath(candidatePath);

    if (site) {
      req.site = site;
      req.sitePath = candidatePath;
      req.remainingPath = '/' + pathParts.slice(i).join('/') || '/';

      // If remaining path is empty (accessing site root), ensure trailing slash for relative URLs
      if (req.remainingPath === '/') {
        if (!req.originalUrl.endsWith('/')) {
          return res.redirect(301, req.originalUrl + '/');
        }
        req.remainingPath = '/index.html';
      }

      return next();
    }
  }

  // No site found for this path
  res.status(404).send('Site not found');
}

module.exports = siteResolver;
