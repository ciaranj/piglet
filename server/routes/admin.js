const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../services/db');
const storage = require('../services/storage');
const authMiddleware = require('../middleware/auth');

const DATA_PATH = process.env.DATA_PATH || './data';
const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE) || 209715200; // 200 MB

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: UPLOADS_PATH,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only zip files are allowed'), false);
    }
  }
});

// ==================== Sites ====================

// List sites (filtered by admin access)
router.get('/sites', authMiddleware.requireAnyAdmin, (req, res) => {
  try {
    let sites;
    if (req.isGlobalAdmin) {
      // Global admins see all sites
      sites = db.getAllSites();
    } else {
      // Site admins only see sites they administer
      sites = db.getSitesByAdmin(req.user.id);
    }

    const sitesWithAuth = sites.map(site => ({
      ...site,
      auth_configs: db.getSiteAuthConfigs(site.id)
    }));
    res.json(sitesWithAuth);
  } catch (error) {
    console.error('Error listing sites:', error);
    res.status(500).json({ error: 'Failed to list sites' });
  }
});

// Create site (all admins can create)
router.post('/sites', authMiddleware.requireAnyAdmin, (req, res) => {
  try {
    const { path: sitePath, name, auth_configs } = req.body;

    if (!sitePath || !name) {
      return res.status(400).json({ error: 'Path and name are required' });
    }

    // Validate path format
    if (!sitePath.startsWith('/')) {
      return res.status(400).json({ error: 'Path must start with /' });
    }

    // Block paths starting with underscore (reserved for system routes)
    if (sitePath.startsWith('/_')) {
      return res.status(400).json({ error: 'Path cannot start with underscore (reserved for system routes)' });
    }

    // Check if path already exists
    const existing = db.getSiteByPath(sitePath);
    if (existing) {
      return res.status(409).json({ error: 'Site with this path already exists' });
    }

    const site = db.createSite({
      id: uuidv4(),
      path: sitePath,
      name,
      created_by: req.user.id
    });

    // Create site directory
    storage.ensureSiteDirectory(sitePath);

    // Set up default auth config if provided
    if (auth_configs && Array.isArray(auth_configs)) {
      auth_configs.forEach(config => {
        db.setSiteAuthConfig({
          id: uuidv4(),
          site_id: site.id,
          auth_type: config.auth_type,
          enabled: config.enabled !== false,
          config: config.config || {}
        });
      });
    } else {
      // Default to anonymous access
      db.setSiteAuthConfig({
        id: uuidv4(),
        site_id: site.id,
        auth_type: 'anonymous',
        enabled: true,
        config: {}
      });
    }

    // Make the creator a site admin (unless they're already a global admin)
    if (!req.isGlobalAdmin) {
      db.addSiteAdmin(uuidv4(), site.id, req.user.id, req.user.id);
    }

    res.status(201).json({
      ...site,
      auth_configs: db.getSiteAuthConfigs(site.id)
    });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// Get site details (site admin or global admin)
router.get('/sites/:id', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({
      ...site,
      auth_configs: db.getSiteAuthConfigs(site.id),
      email_settings: db.getSiteEmailSettings(site.id),
      admins: db.getSiteAdmins(site.id)
    });
  } catch (error) {
    console.error('Error getting site:', error);
    res.status(500).json({ error: 'Failed to get site' });
  }
});

// Update site (site admin or global admin)
router.put('/sites/:id', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const { name, path: newPath } = req.body;
    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (newPath && newPath !== site.path) {
      // Validate new path
      if (!newPath.startsWith('/')) {
        return res.status(400).json({ error: 'Path must start with /' });
      }

      // Block paths starting with underscore (reserved for system routes)
      if (newPath.startsWith('/_')) {
        return res.status(400).json({ error: 'Path cannot start with underscore (reserved for system routes)' });
      }

      const existing = db.getSiteByPath(newPath);
      if (existing) {
        return res.status(409).json({ error: 'Site with this path already exists' });
      }

      // Move site directory
      storage.moveSiteDirectory(site.path, newPath);
      updates.path = newPath;
    }

    const updatedSite = db.updateSite(req.params.id, updates);
    res.json({
      ...updatedSite,
      auth_configs: db.getSiteAuthConfigs(updatedSite.id)
    });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Delete site (global admin only)
router.delete('/sites/:id', authMiddleware.requireAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Delete site directory
    storage.deleteSiteDirectory(site.path);

    // Delete from database (cascades to related tables)
    db.deleteSite(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ==================== Site Content Versions ====================

// List all versions for a site (site admin or global admin)
router.get('/sites/:id/versions', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const versions = db.getContentVersions(site.id);
    const versionsWithSize = versions.map(v => ({
      ...v,
      size_formatted: storage.formatBytes(v.size_bytes)
    }));

    res.json(versionsWithSize);
  } catch (error) {
    console.error('Error listing versions:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Upload new version (site admin or global admin)
router.post('/sites/:id/upload', authMiddleware.requireSiteAdmin, upload.single('file'), async (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      // Clean up uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { description, activate } = req.body;
    const shouldActivate = activate !== 'false' && activate !== false;

    // Check if there's already active content
    const activeVersion = db.getActiveContentVersion(site.id);
    const hasActiveContent = !!activeVersion;

    // Create version record
    const versionId = uuidv4();
    const version = db.createContentVersion({
      id: versionId,
      site_id: site.id,
      description: description || null,
      size_bytes: 0,
      uploaded_by: req.user.id,
      is_active: false
    });

    // Extract zip to version directory
    const sizeBytes = await storage.extractZipToVersion(req.file.path, site.path, versionId);

    // Update the size
    db.updateContentVersionSize(versionId, sizeBytes);

    // Clean up uploaded zip
    fs.unlinkSync(req.file.path);

    // Activate the new version if requested (default behavior)
    if (shouldActivate) {
      db.setActiveContentVersion(site.id, versionId);
    }

    const updatedVersion = db.getContentVersion(versionId);

    res.json({
      success: true,
      message: 'Files uploaded and extracted successfully',
      version: {
        ...updatedVersion,
        size_formatted: storage.formatBytes(updatedVersion.size_bytes),
        is_active: shouldActivate ? 1 : 0
      },
      had_active_content: hasActiveContent,
      previous_version_id: activeVersion?.id || null
    });
  } catch (error) {
    console.error('Error uploading to site:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

// Check if site has active content (site admin or global admin)
router.get('/sites/:id/versions/active', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const activeVersion = db.getActiveContentVersion(site.id);
    if (activeVersion) {
      res.json({
        has_active_content: true,
        version: {
          ...activeVersion,
          size_formatted: storage.formatBytes(activeVersion.size_bytes)
        }
      });
    } else {
      res.json({ has_active_content: false, version: null });
    }
  } catch (error) {
    console.error('Error checking active version:', error);
    res.status(500).json({ error: 'Failed to check active version' });
  }
});

// Activate a specific version (site admin or global admin)
router.put('/sites/:id/versions/:versionId/activate', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const version = db.getContentVersion(req.params.versionId);
    if (!version || version.site_id !== site.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Verify the version directory exists on disk
    if (!storage.versionExists(site.path, version.id)) {
      return res.status(400).json({ error: 'Version content not found on disk' });
    }

    db.setActiveContentVersion(site.id, version.id);

    res.json({
      success: true,
      message: 'Version activated',
      version: {
        ...db.getContentVersion(version.id),
        size_formatted: storage.formatBytes(version.size_bytes)
      }
    });
  } catch (error) {
    console.error('Error activating version:', error);
    res.status(500).json({ error: 'Failed to activate version' });
  }
});

// Delete a specific version (site admin or global admin)
router.delete('/sites/:id/versions/:versionId', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const version = db.getContentVersion(req.params.versionId);
    if (!version || version.site_id !== site.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Check if this is the active version
    if (version.is_active) {
      return res.status(400).json({
        error: 'Cannot delete the active version. Activate a different version first.'
      });
    }

    // Delete from filesystem
    storage.deleteVersionDirectory(site.path, version.id);

    // Delete from database
    db.deleteContentVersion(version.id);

    res.json({ success: true, message: 'Version deleted' });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ==================== Site Auth Config ====================

// Get site auth config (site admin or global admin)
router.get('/sites/:id/auth', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({
      auth_configs: db.getSiteAuthConfigs(site.id),
      email_settings: db.getSiteEmailSettings(site.id)
    });
  } catch (error) {
    console.error('Error getting site auth:', error);
    res.status(500).json({ error: 'Failed to get auth config' });
  }
});

// Update site auth config (site admin or global admin)
router.put('/sites/:id/auth', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const { auth_configs, email_settings } = req.body;

    if (auth_configs && Array.isArray(auth_configs)) {
      // Get existing configs
      const existingConfigs = db.getSiteAuthConfigs(site.id);
      const existingTypes = existingConfigs.map(c => c.auth_type);
      const newTypes = auth_configs.map(c => c.auth_type);

      // Delete removed configs
      existingTypes.forEach(type => {
        if (!newTypes.includes(type)) {
          db.deleteSiteAuthConfig(site.id, type);
        }
      });

      // Update or create configs
      auth_configs.forEach(config => {
        db.setSiteAuthConfig({
          id: uuidv4(),
          site_id: site.id,
          auth_type: config.auth_type,
          enabled: config.enabled !== false,
          config: config.config || {}
        });
      });
    }

    if (email_settings) {
      db.setSiteEmailSettings({
        site_id: site.id,
        flow_type: email_settings.flow_type || 'magic_link',
        allowed_domains: email_settings.allowed_domains || null
      });
    }

    res.json({
      auth_configs: db.getSiteAuthConfigs(site.id),
      email_settings: db.getSiteEmailSettings(site.id)
    });
  } catch (error) {
    console.error('Error updating site auth:', error);
    res.status(500).json({ error: 'Failed to update auth config' });
  }
});

// ==================== Site Admins ====================

// Get site admins (site admin or global admin)
router.get('/sites/:id/admins', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const admins = db.getSiteAdmins(site.id);
    res.json(admins);
  } catch (error) {
    console.error('Error getting site admins:', error);
    res.status(500).json({ error: 'Failed to get site admins' });
  }
});

// Add site admin (site admin or global admin)
router.post('/sites/:id/admins', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const { user_id, email } = req.body;
    let targetUser;

    if (user_id) {
      targetUser = db.getUserById(user_id);
    } else if (email) {
      targetUser = db.getUserByEmail(email);
      if (!targetUser) {
        // Create user if doesn't exist
        targetUser = db.createUser({
          id: uuidv4(),
          email,
          email_verified: false,
          display_name: email.split('@')[0]
        });
      }
    } else {
      return res.status(400).json({ error: 'user_id or email required' });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.addSiteAdmin(uuidv4(), site.id, targetUser.id, req.user.id);

    res.status(201).json({ success: true, user: targetUser });
  } catch (error) {
    console.error('Error adding site admin:', error);
    res.status(500).json({ error: 'Failed to add site admin' });
  }
});

// Remove site admin (site admin or global admin)
router.delete('/sites/:id/admins/:userId', authMiddleware.requireSiteAdmin, (req, res) => {
  try {
    const site = db.getSiteById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    db.removeSiteAdmin(site.id, req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing site admin:', error);
    res.status(500).json({ error: 'Failed to remove site admin' });
  }
});

// ==================== Users ====================

// List all users with their roles (global admin only)
router.get('/users', authMiddleware.requireAdmin, (req, res) => {
  try {
    const users = db.getAllUsers();
    const usersWithRoles = users.map(user => {
      const isGlobalAdmin = db.isGlobalAdmin(user.id);
      const adminSites = db.getSitesByAdmin(user.id);
      return {
        ...user,
        is_global_admin: isGlobalAdmin,
        site_admin_count: adminSites.length,
        admin_sites: adminSites.map(s => ({ id: s.id, name: s.name, path: s.path }))
      };
    });
    res.json(usersWithRoles);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Get user details with roles (global admin only)
router.get('/users/:userId', authMiddleware.requireAdmin, (req, res) => {
  try {
    const user = db.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isGlobalAdmin = db.isGlobalAdmin(user.id);
    const adminSites = db.getSitesByAdmin(user.id);

    res.json({
      ...user,
      is_global_admin: isGlobalAdmin,
      admin_sites: adminSites.map(s => ({ id: s.id, name: s.name, path: s.path }))
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== Global Admins ====================

// Get global admins (global admin only)
router.get('/admins', authMiddleware.requireAdmin, (req, res) => {
  try {
    const admins = db.getGlobalAdmins();
    res.json(admins);
  } catch (error) {
    console.error('Error getting global admins:', error);
    res.status(500).json({ error: 'Failed to get global admins' });
  }
});

// Add global admin (global admin only)
router.post('/admins', authMiddleware.requireAdmin, (req, res) => {
  try {
    const { user_id, email } = req.body;
    let targetUser;

    if (user_id) {
      targetUser = db.getUserById(user_id);
    } else if (email) {
      targetUser = db.getUserByEmail(email);
      if (!targetUser) {
        // Create user if doesn't exist
        targetUser = db.createUser({
          id: uuidv4(),
          email,
          email_verified: false,
          display_name: email.split('@')[0]
        });
      }
    } else {
      return res.status(400).json({ error: 'user_id or email required' });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.addGlobalAdmin(targetUser.id, req.user.id);

    res.status(201).json({ success: true, user: targetUser });
  } catch (error) {
    console.error('Error adding global admin:', error);
    res.status(500).json({ error: 'Failed to add global admin' });
  }
});

// Remove global admin (global admin only)
router.delete('/admins/:userId', authMiddleware.requireAdmin, (req, res) => {
  try {
    // Prevent removing self
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself as admin' });
    }

    db.removeGlobalAdmin(req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing global admin:', error);
    res.status(500).json({ error: 'Failed to remove global admin' });
  }
});

module.exports = router;
