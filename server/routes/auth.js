const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const email = require('../services/email');
const oauth = require('../services/oauth');

const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE) || 86400000;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';

// Get current session
router.get('/session', (req, res) => {
  const sessionId = req.session?.pigletSession;
  if (!sessionId) {
    return res.json({ authenticated: false });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.json({ authenticated: false });
  }

  const user = db.getUserById(session.user_id);
  const isGlobalAdmin = db.isGlobalAdmin(session.user_id);
  const isSiteAdminRole = db.isSiteAdminRole(session.user_id);
  const isAdmin = isGlobalAdmin || isSiteAdminRole;

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      email_verified: !!user.email_verified
    },
    auth_type: session.auth_type,
    site_id: session.site_id,
    is_admin: isAdmin,
    is_global_admin: isGlobalAdmin,
    is_site_admin_role: isSiteAdminRole
  });
});

// Logout
router.post('/logout', (req, res) => {
  const sessionId = req.session?.pigletSession;
  if (sessionId) {
    db.deleteSession(sessionId);
  }
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// ==================== Entra ID (Admin) ====================

router.get('/entra/login', (req, res) => {
  const state = uuidv4();
  req.session.oauthState = state;
  req.session.returnTo = req.query.returnTo || '/_pigsty';

  const authUrl = oauth.getEntraAuthUrl(state);
  res.redirect(authUrl);
});

router.get('/entra/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (state !== req.session.oauthState) {
      return res.status(400).send('Invalid state parameter');
    }

    const tokens = await oauth.exchangeEntraCode(code);
    const profile = await oauth.getEntraProfile(tokens.access_token);

    // Find or create user
    let identity = db.getUserIdentity('entra', profile.id);
    let user;

    if (identity) {
      user = db.getUserById(identity.user_id);
    } else {
      // Check if user exists with this email
      user = db.getUserByEmail(profile.email);

      if (!user) {
        // Create new user
        user = db.createUser({
          id: uuidv4(),
          email: profile.email,
          email_verified: true,
          display_name: profile.displayName
        });
      }

      // Link Entra identity
      db.createUserIdentity({
        id: uuidv4(),
        user_id: user.id,
        provider: 'entra',
        provider_id: profile.id,
        email: profile.email
      });
    }

    // Check if user is a global admin (auto-promote first user if no admins exist)
    if (!db.isGlobalAdmin(user.id)) {
      if (!db.hasAnyGlobalAdmins()) {
        // First user to log in becomes a global admin
        db.addGlobalAdmin(user.id, user.id);
        console.log(`Auto-promoted first user ${user.email} to global admin`);
      } else {
        return res.status(403).send('Access denied. You are not an administrator.');
      }
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

    db.createSession({
      id: sessionId,
      user_id: user.id,
      auth_type: 'entra',
      site_id: null,
      expires_at: expiresAt
    });

    req.session.pigletSession = sessionId;
    const returnTo = req.session.returnTo || '/_pigsty';
    delete req.session.returnTo;
    delete req.session.oauthState;

    res.redirect(returnTo);
  } catch (error) {
    console.error('Entra callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ==================== Google OAuth ====================

router.get('/google/login', (req, res) => {
  const { site } = req.query;
  if (!site) {
    return res.status(400).send('Site parameter required');
  }

  const siteObj = db.getSiteByPath(site);
  if (!siteObj) {
    return res.status(404).send('Site not found');
  }

  // Check if Google auth is enabled for this site
  const authConfigs = db.getSiteAuthConfigs(siteObj.id);
  const googleConfig = authConfigs.find(c => c.auth_type === 'google' && c.enabled);
  if (!googleConfig) {
    return res.status(403).send('Google authentication not enabled for this site');
  }

  const state = uuidv4();
  req.session.oauthState = state;
  req.session.siteId = siteObj.id;
  req.session.sitePath = site;
  req.session.returnTo = req.query.returnTo || site;

  const authUrl = oauth.getGoogleAuthUrl(state);
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (state !== req.session.oauthState) {
      return res.status(400).send('Invalid state parameter');
    }

    const siteId = req.session.siteId;
    const sitePath = req.session.sitePath;

    if (!siteId) {
      return res.status(400).send('No site context found');
    }

    const tokens = await oauth.exchangeGoogleCode(code);
    const profile = await oauth.getGoogleProfile(tokens.access_token);

    // Find or create user
    let identity = db.getUserIdentity('google', profile.id);
    let user;

    if (identity) {
      user = db.getUserById(identity.user_id);
    } else {
      // Check if user exists with this email
      user = db.getUserByEmail(profile.email);

      if (!user) {
        // Create new user
        user = db.createUser({
          id: uuidv4(),
          email: profile.email,
          email_verified: profile.verified_email,
          display_name: profile.name
        });
      }

      // Link Google identity
      db.createUserIdentity({
        id: uuidv4(),
        user_id: user.id,
        provider: 'google',
        provider_id: profile.id,
        email: profile.email
      });
    }

    // Create site-scoped session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

    db.createSession({
      id: sessionId,
      user_id: user.id,
      auth_type: 'google',
      site_id: siteId,
      expires_at: expiresAt
    });

    req.session.pigletSession = sessionId;
    const returnTo = req.session.returnTo || sitePath;
    delete req.session.returnTo;
    delete req.session.oauthState;
    delete req.session.siteId;
    delete req.session.sitePath;

    res.redirect(returnTo);
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ==================== Microsoft OAuth ====================

router.get('/microsoft/login', (req, res) => {
  const { site } = req.query;
  if (!site) {
    return res.status(400).send('Site parameter required');
  }

  const siteObj = db.getSiteByPath(site);
  if (!siteObj) {
    return res.status(404).send('Site not found');
  }

  // Check if Microsoft auth is enabled for this site
  const authConfigs = db.getSiteAuthConfigs(siteObj.id);
  const msConfig = authConfigs.find(c => c.auth_type === 'microsoft' && c.enabled);
  if (!msConfig) {
    return res.status(403).send('Microsoft authentication not enabled for this site');
  }

  const state = uuidv4();
  req.session.oauthState = state;
  req.session.siteId = siteObj.id;
  req.session.sitePath = site;
  req.session.returnTo = req.query.returnTo || site;

  const authUrl = oauth.getMicrosoftAuthUrl(state);
  res.redirect(authUrl);
});

router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (state !== req.session.oauthState) {
      return res.status(400).send('Invalid state parameter');
    }

    const siteId = req.session.siteId;
    const sitePath = req.session.sitePath;

    if (!siteId) {
      return res.status(400).send('No site context found');
    }

    const tokens = await oauth.exchangeMicrosoftCode(code);
    const profile = await oauth.getMicrosoftProfile(tokens.access_token);

    // Find or create user
    let identity = db.getUserIdentity('microsoft', profile.id);
    let user;

    if (identity) {
      user = db.getUserById(identity.user_id);
    } else {
      // Check if user exists with this email
      user = db.getUserByEmail(profile.mail || profile.userPrincipalName);

      if (!user) {
        // Create new user
        user = db.createUser({
          id: uuidv4(),
          email: profile.mail || profile.userPrincipalName,
          email_verified: true,
          display_name: profile.displayName
        });
      }

      // Link Microsoft identity
      db.createUserIdentity({
        id: uuidv4(),
        user_id: user.id,
        provider: 'microsoft',
        provider_id: profile.id,
        email: profile.mail || profile.userPrincipalName
      });
    }

    // Create site-scoped session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

    db.createSession({
      id: sessionId,
      user_id: user.id,
      auth_type: 'microsoft',
      site_id: siteId,
      expires_at: expiresAt
    });

    req.session.pigletSession = sessionId;
    const returnTo = req.session.returnTo || sitePath;
    delete req.session.returnTo;
    delete req.session.oauthState;
    delete req.session.siteId;
    delete req.session.sitePath;

    res.redirect(returnTo);
  } catch (error) {
    console.error('Microsoft callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ==================== Email Auth ====================

router.post('/email/send', async (req, res) => {
  try {
    const { email: userEmail, site } = req.body;

    if (!userEmail || !site) {
      return res.status(400).json({ error: 'Email and site are required' });
    }

    const siteObj = db.getSiteByPath(site);
    if (!siteObj) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Check if email auth is enabled
    const authConfigs = db.getSiteAuthConfigs(siteObj.id);
    const emailConfig = authConfigs.find(c => c.auth_type === 'email' && c.enabled);
    if (!emailConfig) {
      return res.status(403).json({ error: 'Email authentication not enabled for this site' });
    }

    // Check email settings
    const emailSettings = db.getSiteEmailSettings(siteObj.id);
    if (emailSettings?.allowed_domains?.length > 0) {
      const domain = userEmail.split('@')[1];
      if (!emailSettings.allowed_domains.includes(domain)) {
        return res.status(403).json({ error: 'Email domain not allowed for this site' });
      }
    }

    // Generate token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    const purpose = emailSettings?.flow_type === 'register' ? 'verify_registration' : 'magic_link';

    db.createEmailToken({
      token,
      email: userEmail,
      site_id: siteObj.id,
      purpose,
      expires_at: expiresAt
    });

    // Send email
    const verifyUrl = `${BASE_URL}/_auth/email/verify/${token}`;
    await email.sendMagicLink(userEmail, verifyUrl, siteObj.name);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

router.get('/email/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const tokenRecord = db.getEmailToken(token);
    if (!tokenRecord) {
      return res.status(400).send('Invalid or expired token');
    }

    // Mark token as used
    db.markEmailTokenUsed(token);

    // Find or create user
    let user = db.getUserByEmail(tokenRecord.email);
    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        email: tokenRecord.email,
        email_verified: true,
        display_name: tokenRecord.email.split('@')[0]
      });
    } else if (!user.email_verified) {
      db.updateUser(user.id, { email_verified: true });
    }

    // For register flow, add to site_users
    if (tokenRecord.purpose === 'verify_registration' && tokenRecord.site_id) {
      const existingSiteUser = db.getSiteUser(tokenRecord.site_id, user.id);
      if (!existingSiteUser) {
        db.registerSiteUser(uuidv4(), tokenRecord.site_id, user.id);
      }
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

    db.createSession({
      id: sessionId,
      user_id: user.id,
      auth_type: 'email',
      site_id: tokenRecord.site_id,
      expires_at: expiresAt
    });

    req.session.pigletSession = sessionId;

    // Redirect to site
    const site = db.getSiteById(tokenRecord.site_id);
    res.redirect(site ? site.path : '/');
  } catch (error) {
    console.error('Email verify error:', error);
    res.status(500).send('Verification failed');
  }
});

router.post('/email/register', async (req, res) => {
  try {
    const { email: userEmail, site, display_name } = req.body;

    if (!userEmail || !site) {
      return res.status(400).json({ error: 'Email and site are required' });
    }

    const siteObj = db.getSiteByPath(site);
    if (!siteObj) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Check if email auth with register flow is enabled
    const authConfigs = db.getSiteAuthConfigs(siteObj.id);
    const emailConfig = authConfigs.find(c => c.auth_type === 'email' && c.enabled);
    if (!emailConfig) {
      return res.status(403).json({ error: 'Email authentication not enabled for this site' });
    }

    const emailSettings = db.getSiteEmailSettings(siteObj.id);
    if (emailSettings?.flow_type !== 'register') {
      return res.status(400).json({ error: 'Registration not enabled for this site' });
    }

    // Check domain restrictions
    if (emailSettings?.allowed_domains?.length > 0) {
      const domain = userEmail.split('@')[1];
      if (!emailSettings.allowed_domains.includes(domain)) {
        return res.status(403).json({ error: 'Email domain not allowed for this site' });
      }
    }

    // Check if user already exists and is registered for this site
    const existingUser = db.getUserByEmail(userEmail);
    if (existingUser) {
      const siteUser = db.getSiteUser(siteObj.id, existingUser.id);
      if (siteUser) {
        return res.status(400).json({ error: 'User already registered for this site' });
      }
    }

    // Generate verification token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    db.createEmailToken({
      token,
      email: userEmail,
      site_id: siteObj.id,
      purpose: 'verify_registration',
      expires_at: expiresAt
    });

    // Send verification email
    const verifyUrl = `${BASE_URL}/_auth/email/verify/${token}`;
    await email.sendVerificationEmail(userEmail, verifyUrl, siteObj.name);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
