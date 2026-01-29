const db = require('../services/db');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  const sessionId = req.session?.pigletSession;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.session.authType = session.auth_type;
  req.session.siteId = session.site_id;

  next();
}

// Middleware to require global admin privileges
function requireAdmin(req, res, next) {
  const sessionId = req.session?.pigletSession;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const isAdmin = db.isGlobalAdmin(user.id);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  req.user = user;
  req.session.authType = session.auth_type;

  next();
}

// Middleware to require site admin privileges
function requireSiteAdmin(req, res, next) {
  const sessionId = req.session?.pigletSession;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Global admins can access all sites
  if (db.isGlobalAdmin(user.id)) {
    req.user = user;
    return next();
  }

  // Check site admin
  const siteId = req.params.id || req.body.site_id;
  if (!siteId) {
    return res.status(400).json({ error: 'Site ID required' });
  }

  if (!db.isSiteAdmin(siteId, user.id)) {
    return res.status(403).json({ error: 'Site admin privileges required' });
  }

  req.user = user;
  next();
}

// Middleware to require any admin privileges (global admin, site admin role, or site admin of at least one site)
function requireAnyAdmin(req, res, next) {
  const sessionId = req.session?.pigletSession;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Check if user has any admin privileges
  const isGlobalAdmin = db.isGlobalAdmin(user.id);
  const isSiteAdminRole = db.isSiteAdminRole(user.id);
  const adminSites = db.getSitesByAdmin(user.id);

  if (!isGlobalAdmin && !isSiteAdminRole && adminSites.length === 0) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  req.user = user;
  req.isGlobalAdmin = isGlobalAdmin;
  req.isSiteAdminRole = isSiteAdminRole;
  next();
}

// Get current user from session if exists (doesn't require auth)
function loadUser(req, res, next) {
  const sessionId = req.session?.pigletSession;

  if (sessionId) {
    const session = db.getSessionById(sessionId);
    if (session) {
      const user = db.getUserById(session.user_id);
      if (user) {
        req.user = user;
        req.authSession = session;
      }
    }
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSiteAdmin,
  requireAnyAdmin,
  loadUser
};
