const db = require('../services/db');

/**
 * Site authentication middleware
 * Enforces the authentication requirements for each site
 */
async function siteAuth(req, res, next) {
  // If no site resolved, skip
  if (!req.site) {
    return next();
  }

  const authConfigs = db.getSiteAuthConfigs(req.site.id);

  // Check if anonymous access is allowed
  const anonymousConfig = authConfigs.find(c => c.auth_type === 'anonymous' && c.enabled);
  if (anonymousConfig) {
    return next();
  }

  // If no auth configs, default to requiring auth
  if (authConfigs.length === 0 || authConfigs.every(c => !c.enabled)) {
    return res.status(403).send('Access denied - no authentication methods configured');
  }

  // Check for valid session
  const sessionId = req.session?.pigletSession;
  if (!sessionId) {
    return redirectToLogin(req, res, authConfigs);
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return redirectToLogin(req, res, authConfigs);
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return redirectToLogin(req, res, authConfigs);
  }

  // Global admins have access to all sites
  if (db.isGlobalAdmin(user.id)) {
    req.user = user;
    return next();
  }

  // Check if user's auth method is accepted by this site
  const userAuthType = session.auth_type;
  const matchingConfig = authConfigs.find(c => c.auth_type === userAuthType && c.enabled);

  if (!matchingConfig) {
    // User authenticated with a method not accepted by this site
    return res.status(403).send('Your authentication method is not accepted by this site');
  }

  // For email auth, check domain restrictions
  if (userAuthType === 'email' && user.email) {
    const emailSettings = db.getSiteEmailSettings(req.site.id);
    if (emailSettings?.allowed_domains?.length > 0) {
      const domain = user.email.split('@')[1];
      if (!emailSettings.allowed_domains.includes(domain)) {
        return res.status(403).send('Your email domain is not allowed for this site');
      }
    }

    // For register flow, check if user is registered for this site
    if (emailSettings?.flow_type === 'register') {
      const siteUser = db.getSiteUser(req.site.id, user.id);
      if (!siteUser) {
        return redirectToRegister(req, res);
      }
    }
  }

  req.user = user;
  next();
}

/**
 * Redirect to appropriate login based on available auth methods
 */
function redirectToLogin(req, res, authConfigs) {
  const enabledConfigs = authConfigs.filter(c => c.enabled);

  // Prefer returning JSON for API-like requests
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(401).json({
      error: 'Authentication required',
      auth_methods: enabledConfigs.map(c => c.auth_type),
      site_path: req.sitePath
    });
  }

  // If only one auth method, redirect directly
  if (enabledConfigs.length === 1) {
    const config = enabledConfigs[0];
    const returnTo = encodeURIComponent(req.originalUrl);

    switch (config.auth_type) {
      case 'google':
        return res.redirect(`/_auth/google/login?site=${encodeURIComponent(req.sitePath)}&returnTo=${returnTo}`);
      case 'microsoft':
        return res.redirect(`/_auth/microsoft/login?site=${encodeURIComponent(req.sitePath)}&returnTo=${returnTo}`);
      case 'email':
        // Redirect to email login page
        return res.redirect(`/_auth/login?site=${encodeURIComponent(req.sitePath)}&returnTo=${returnTo}&method=email`);
      default:
        return res.status(401).send('Authentication required');
    }
  }

  // Multiple auth methods - show login page with options
  const returnTo = encodeURIComponent(req.originalUrl);
  res.redirect(`/_auth/login?site=${encodeURIComponent(req.sitePath)}&returnTo=${returnTo}`);
}

/**
 * Redirect to registration page for register-flow email auth
 */
function redirectToRegister(req, res) {
  const returnTo = encodeURIComponent(req.originalUrl);
  res.redirect(`/_auth/register?site=${encodeURIComponent(req.sitePath)}&returnTo=${returnTo}`);
}

module.exports = siteAuth;
