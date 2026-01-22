const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_PATH = process.env.DATA_PATH || './data';
const DB_PATH = process.env.DB_PATH || path.join(DATA_PATH, 'piglet.db');

let db = null;

function getDb() {
  if (!db) {
    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initialize() {
  const database = getDb();

  // Create tables
  database.exec(`
    -- Sites table
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    );

    -- Site authentication config
    CREATE TABLE IF NOT EXISTS site_auth_configs (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      auth_type TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config JSON,
      UNIQUE(site_id, auth_type)
    );

    -- Email auth settings (when auth_type = 'email')
    CREATE TABLE IF NOT EXISTS site_email_settings (
      site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      flow_type TEXT NOT NULL,
      allowed_domains JSON
    );

    -- Users (single principal across piglet)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      email_verified INTEGER DEFAULT 0,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Social identities linked to users
    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_id)
    );

    -- Site-specific user registrations (for email auth with 'register' flow)
    CREATE TABLE IF NOT EXISTS site_users (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, user_id)
    );

    -- Global admins (super admins who access _pigsty)
    CREATE TABLE IF NOT EXISTS global_admins (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      added_by TEXT
    );

    -- Site admins (can upload and configure specific sites)
    CREATE TABLE IF NOT EXISTS site_admins (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      added_by TEXT,
      UNIQUE(site_id, user_id)
    );

    -- Email verification tokens (magic links)
    CREATE TABLE IF NOT EXISTS email_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0
    );

    -- Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      auth_type TEXT NOT NULL,
      site_id TEXT REFERENCES sites(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    -- Site content versions (tracks uploaded content)
    CREATE TABLE IF NOT EXISTS site_content_versions (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      description TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      uploaded_by TEXT,
      is_active INTEGER DEFAULT 0
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_site_content_versions_site_id ON site_content_versions(site_id);
    CREATE INDEX IF NOT EXISTS idx_sites_path ON sites(path);
    CREATE INDEX IF NOT EXISTS idx_site_auth_configs_site_id ON site_auth_configs(site_id);
    CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_identities_provider ON user_identities(provider, provider_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_tokens(email);
  `);

  console.log('Database initialized');
  return database;
}

// Helper functions for common operations
function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

function transaction(fn) {
  return getDb().transaction(fn)();
}

// Site operations
function getSiteByPath(sitePath) {
  return get('SELECT * FROM sites WHERE path = ?', [sitePath]);
}

function getSiteById(id) {
  return get('SELECT * FROM sites WHERE id = ?', [id]);
}

function getAllSites() {
  return all('SELECT * FROM sites ORDER BY path');
}

function createSite(site) {
  run(
    'INSERT INTO sites (id, path, name, created_by) VALUES (?, ?, ?, ?)',
    [site.id, site.path, site.name, site.created_by]
  );
  return getSiteById(site.id);
}

function updateSite(id, updates) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.path !== undefined) {
    fields.push('path = ?');
    values.push(updates.path);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    run(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return getSiteById(id);
}

function deleteSite(id) {
  return run('DELETE FROM sites WHERE id = ?', [id]);
}

// Site auth config operations
function getSiteAuthConfigs(siteId) {
  return all('SELECT * FROM site_auth_configs WHERE site_id = ?', [siteId]);
}

function setSiteAuthConfig(config) {
  run(
    `INSERT INTO site_auth_configs (id, site_id, auth_type, enabled, config)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(site_id, auth_type) DO UPDATE SET enabled = ?, config = ?`,
    [config.id, config.site_id, config.auth_type, config.enabled ? 1 : 0,
     JSON.stringify(config.config), config.enabled ? 1 : 0, JSON.stringify(config.config)]
  );
}

function deleteSiteAuthConfig(siteId, authType) {
  return run('DELETE FROM site_auth_configs WHERE site_id = ? AND auth_type = ?', [siteId, authType]);
}

// Email settings operations
function getSiteEmailSettings(siteId) {
  const row = get('SELECT * FROM site_email_settings WHERE site_id = ?', [siteId]);
  if (row && row.allowed_domains) {
    row.allowed_domains = JSON.parse(row.allowed_domains);
  }
  return row;
}

function setSiteEmailSettings(settings) {
  run(
    `INSERT INTO site_email_settings (site_id, flow_type, allowed_domains)
     VALUES (?, ?, ?)
     ON CONFLICT(site_id) DO UPDATE SET flow_type = ?, allowed_domains = ?`,
    [settings.site_id, settings.flow_type, JSON.stringify(settings.allowed_domains),
     settings.flow_type, JSON.stringify(settings.allowed_domains)]
  );
}

// User operations
function getUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

function getUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ?', [email]);
}

function createUser(user) {
  run(
    'INSERT INTO users (id, email, email_verified, display_name) VALUES (?, ?, ?, ?)',
    [user.id, user.email, user.email_verified ? 1 : 0, user.display_name]
  );
  return getUserById(user.id);
}

function updateUser(id, updates) {
  const fields = [];
  const values = [];

  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.email_verified !== undefined) {
    fields.push('email_verified = ?');
    values.push(updates.email_verified ? 1 : 0);
  }
  if (updates.display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(updates.display_name);
  }

  if (fields.length > 0) {
    values.push(id);
    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return getUserById(id);
}

// User identity operations
function getUserIdentity(provider, providerId) {
  return get(
    'SELECT * FROM user_identities WHERE provider = ? AND provider_id = ?',
    [provider, providerId]
  );
}

function getUserIdentitiesByUserId(userId) {
  return all('SELECT * FROM user_identities WHERE user_id = ?', [userId]);
}

function createUserIdentity(identity) {
  run(
    'INSERT INTO user_identities (id, user_id, provider, provider_id, email) VALUES (?, ?, ?, ?, ?)',
    [identity.id, identity.user_id, identity.provider, identity.provider_id, identity.email]
  );
}

// Admin operations
function isGlobalAdmin(userId) {
  return !!get('SELECT 1 FROM global_admins WHERE user_id = ?', [userId]);
}

function hasAnyGlobalAdmins() {
  return !!get('SELECT 1 FROM global_admins LIMIT 1');
}

function getGlobalAdmins() {
  return all(`
    SELECT u.*, ga.added_at, ga.added_by
    FROM global_admins ga
    JOIN users u ON ga.user_id = u.id
  `);
}

function addGlobalAdmin(userId, addedBy) {
  run(
    'INSERT OR IGNORE INTO global_admins (user_id, added_by) VALUES (?, ?)',
    [userId, addedBy]
  );
}

function removeGlobalAdmin(userId) {
  return run('DELETE FROM global_admins WHERE user_id = ?', [userId]);
}

function isSiteAdmin(siteId, userId) {
  return !!get(
    'SELECT 1 FROM site_admins WHERE site_id = ? AND user_id = ?',
    [siteId, userId]
  );
}

function getSiteAdmins(siteId) {
  return all(`
    SELECT u.*, sa.added_at, sa.added_by
    FROM site_admins sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.site_id = ?
  `, [siteId]);
}

function addSiteAdmin(id, siteId, userId, addedBy) {
  run(
    'INSERT OR IGNORE INTO site_admins (id, site_id, user_id, added_by) VALUES (?, ?, ?, ?)',
    [id, siteId, userId, addedBy]
  );
}

function removeSiteAdmin(siteId, userId) {
  return run('DELETE FROM site_admins WHERE site_id = ? AND user_id = ?', [siteId, userId]);
}

// Session operations
function createSession(session) {
  run(
    'INSERT INTO sessions (id, user_id, auth_type, site_id, expires_at) VALUES (?, ?, ?, ?, ?)',
    [session.id, session.user_id, session.auth_type, session.site_id, session.expires_at]
  );
  return getSessionById(session.id);
}

function getSessionById(id) {
  return get("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')", [id]);
}

function deleteSession(id) {
  return run('DELETE FROM sessions WHERE id = ?', [id]);
}

function cleanupExpiredSessions() {
  return run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}

// Email token operations
function createEmailToken(token) {
  run(
    'INSERT INTO email_tokens (token, email, site_id, purpose, expires_at) VALUES (?, ?, ?, ?, ?)',
    [token.token, token.email, token.site_id, token.purpose, token.expires_at]
  );
}

function getEmailToken(token) {
  return get(
    "SELECT * FROM email_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0",
    [token]
  );
}

function markEmailTokenUsed(token) {
  return run('UPDATE email_tokens SET used = 1 WHERE token = ?', [token]);
}

function cleanupExpiredTokens() {
  return run("DELETE FROM email_tokens WHERE expires_at <= datetime('now')");
}

// Site user registration operations
function getSiteUser(siteId, userId) {
  return get(
    'SELECT * FROM site_users WHERE site_id = ? AND user_id = ?',
    [siteId, userId]
  );
}

function registerSiteUser(id, siteId, userId) {
  run(
    'INSERT OR IGNORE INTO site_users (id, site_id, user_id) VALUES (?, ?, ?)',
    [id, siteId, userId]
  );
}

// Site content version operations
function getContentVersions(siteId) {
  return all(
    'SELECT * FROM site_content_versions WHERE site_id = ? ORDER BY uploaded_at DESC',
    [siteId]
  );
}

function getContentVersion(id) {
  return get('SELECT * FROM site_content_versions WHERE id = ?', [id]);
}

function getActiveContentVersion(siteId) {
  return get(
    'SELECT * FROM site_content_versions WHERE site_id = ? AND is_active = 1',
    [siteId]
  );
}

function createContentVersion(version) {
  run(
    `INSERT INTO site_content_versions (id, site_id, description, size_bytes, uploaded_by, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [version.id, version.site_id, version.description, version.size_bytes, version.uploaded_by, version.is_active ? 1 : 0]
  );
  return getContentVersion(version.id);
}

function setActiveContentVersion(siteId, versionId) {
  // Deactivate all versions for this site
  run('UPDATE site_content_versions SET is_active = 0 WHERE site_id = ?', [siteId]);
  // Activate the specified version
  run('UPDATE site_content_versions SET is_active = 1 WHERE id = ? AND site_id = ?', [versionId, siteId]);
}

function deleteContentVersion(id) {
  return run('DELETE FROM site_content_versions WHERE id = ?', [id]);
}

function updateContentVersionSize(id, sizeBytes) {
  return run('UPDATE site_content_versions SET size_bytes = ? WHERE id = ?', [sizeBytes, id]);
}

module.exports = {
  getDb,
  initialize,
  get,
  all,
  run,
  transaction,

  // Sites
  getSiteByPath,
  getSiteById,
  getAllSites,
  createSite,
  updateSite,
  deleteSite,

  // Site auth
  getSiteAuthConfigs,
  setSiteAuthConfig,
  deleteSiteAuthConfig,
  getSiteEmailSettings,
  setSiteEmailSettings,

  // Users
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  getUserIdentity,
  getUserIdentitiesByUserId,
  createUserIdentity,

  // Admins
  isGlobalAdmin,
  hasAnyGlobalAdmins,
  getGlobalAdmins,
  addGlobalAdmin,
  removeGlobalAdmin,
  isSiteAdmin,
  getSiteAdmins,
  addSiteAdmin,
  removeSiteAdmin,

  // Sessions
  createSession,
  getSessionById,
  deleteSession,
  cleanupExpiredSessions,

  // Email tokens
  createEmailToken,
  getEmailToken,
  markEmailTokenUsed,
  cleanupExpiredTokens,

  // Site users
  getSiteUser,
  registerSiteUser,

  // Content versions
  getContentVersions,
  getContentVersion,
  getActiveContentVersion,
  createContentVersion,
  setActiveContentVersion,
  deleteContentVersion,
  updateContentVersionSize
};
