const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const DATA_PATH = process.env.DATA_PATH || './data';
const SITES_PATH = path.join(DATA_PATH, 'sites');
const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');

/**
 * Convert a site path to a directory name
 * /help -> help
 * /productdocs/9.1 -> productdocs__9.1
 */
function pathToDirectoryName(sitePath) {
  // Remove leading slash and replace remaining slashes with double underscore
  return sitePath.replace(/^\//, '').replace(/\//g, '__');
}

/**
 * Convert a directory name back to a site path
 * help -> /help
 * productdocs__9.1 -> /productdocs/9.1
 */
function directoryNameToPath(dirName) {
  return '/' + dirName.replace(/__/g, '/');
}

/**
 * Ensure data directories exist
 */
function ensureDataDirectories() {
  [DATA_PATH, SITES_PATH, UPLOADS_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Ensure a site directory exists (with versions subdirectory)
 */
function ensureSiteDirectory(sitePath) {
  ensureDataDirectories();
  const dirName = pathToDirectoryName(sitePath);
  const fullPath = path.join(SITES_PATH, dirName, 'versions');

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  return path.join(SITES_PATH, dirName);
}

/**
 * Get the full path to a site's directory
 */
function getSiteDirectory(sitePath) {
  const dirName = pathToDirectoryName(sitePath);
  return path.join(SITES_PATH, dirName);
}

/**
 * Get the path to a specific content version
 */
function getVersionDirectory(sitePath, versionId) {
  const siteDir = getSiteDirectory(sitePath);
  return path.join(siteDir, 'versions', versionId);
}

/**
 * Delete a site's directory (all versions)
 */
function deleteSiteDirectory(sitePath) {
  const fullPath = getSiteDirectory(sitePath);

  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

/**
 * Delete a specific content version
 */
function deleteVersionDirectory(sitePath, versionId) {
  const versionDir = getVersionDirectory(sitePath, versionId);

  if (fs.existsSync(versionDir)) {
    fs.rmSync(versionDir, { recursive: true, force: true });
  }
}

/**
 * Move/rename a site's directory
 */
function moveSiteDirectory(oldPath, newPath) {
  const oldFullPath = getSiteDirectory(oldPath);
  const newFullPath = getSiteDirectory(newPath);

  if (fs.existsSync(oldFullPath)) {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(newFullPath), { recursive: true });
    fs.renameSync(oldFullPath, newFullPath);
  }
}

/**
 * Extract a zip file to a specific version directory
 * Returns the size in bytes of the extracted content
 */
async function extractZipToVersion(zipPath, sitePath, versionId) {
  ensureSiteDirectory(sitePath);
  const versionDir = getVersionDirectory(sitePath, versionId);

  // Create version directory
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  // Extract zip
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: versionDir }))
      .on('close', () => {
        // Check if content was extracted into a single subdirectory
        // If so, move contents up one level
        const extractedEntries = fs.readdirSync(versionDir);
        if (extractedEntries.length === 1) {
          const singleEntry = path.join(versionDir, extractedEntries[0]);
          const stats = fs.statSync(singleEntry);

          if (stats.isDirectory()) {
            // Move all contents up
            const innerEntries = fs.readdirSync(singleEntry);
            for (const entry of innerEntries) {
              const srcPath = path.join(singleEntry, entry);
              const destPath = path.join(versionDir, entry);
              fs.renameSync(srcPath, destPath);
            }
            // Remove the now-empty subdirectory
            fs.rmdirSync(singleEntry);
          }
        }

        // Calculate and return the size
        const size = getDirectorySizeSync(versionDir);
        resolve(size);
      })
      .on('error', reject);
  });
}

/**
 * Legacy function - extract to site root (for backwards compatibility)
 * @deprecated Use extractZipToVersion instead
 */
async function extractZipToSite(zipPath, sitePath) {
  const siteDir = ensureSiteDirectory(sitePath);

  // Clear existing content in root (not versions)
  const entries = fs.readdirSync(siteDir);
  for (const entry of entries) {
    if (entry !== 'versions') {
      fs.rmSync(path.join(siteDir, entry), { recursive: true, force: true });
    }
  }

  // Extract zip to root
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: siteDir }))
      .on('close', () => {
        const extractedEntries = fs.readdirSync(siteDir).filter(e => e !== 'versions');
        if (extractedEntries.length === 1) {
          const singleEntry = path.join(siteDir, extractedEntries[0]);
          const stats = fs.statSync(singleEntry);

          if (stats.isDirectory()) {
            const innerEntries = fs.readdirSync(singleEntry);
            for (const entry of innerEntries) {
              const srcPath = path.join(singleEntry, entry);
              const destPath = path.join(siteDir, entry);
              fs.renameSync(srcPath, destPath);
            }
            fs.rmdirSync(singleEntry);
          }
        }
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * List all site directories
 */
function listSiteDirectories() {
  ensureDataDirectories();

  if (!fs.existsSync(SITES_PATH)) {
    return [];
  }

  return fs.readdirSync(SITES_PATH)
    .filter(entry => {
      const fullPath = path.join(SITES_PATH, entry);
      return fs.statSync(fullPath).isDirectory();
    })
    .map(dirName => ({
      dirName,
      path: directoryNameToPath(dirName),
      fullPath: path.join(SITES_PATH, dirName)
    }));
}

/**
 * Get the size of a directory (synchronous)
 */
function getDirectorySizeSync(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let size = 0;
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      size += getDirectorySizeSync(fullPath);
    } else {
      size += stats.size;
    }
  }

  return size;
}

/**
 * Get the size of a site's content (all versions)
 */
function getSiteSize(sitePath) {
  const siteDir = getSiteDirectory(sitePath);
  return getDirectorySizeSync(siteDir);
}

/**
 * Get the size of a specific version
 */
function getVersionSize(sitePath, versionId) {
  const versionDir = getVersionDirectory(sitePath, versionId);
  return getDirectorySizeSync(versionDir);
}

/**
 * Check if a site has any content versions
 */
function siteHasContent(sitePath) {
  const versionsDir = path.join(getSiteDirectory(sitePath), 'versions');

  if (!fs.existsSync(versionsDir)) {
    return false;
  }

  const entries = fs.readdirSync(versionsDir);
  return entries.length > 0;
}

/**
 * Check if a specific version exists
 */
function versionExists(sitePath, versionId) {
  const versionDir = getVersionDirectory(sitePath, versionId);
  return fs.existsSync(versionDir);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize data directories on module load
ensureDataDirectories();

module.exports = {
  pathToDirectoryName,
  directoryNameToPath,
  ensureDataDirectories,
  ensureSiteDirectory,
  getSiteDirectory,
  getVersionDirectory,
  deleteSiteDirectory,
  deleteVersionDirectory,
  moveSiteDirectory,
  extractZipToSite,
  extractZipToVersion,
  listSiteDirectories,
  getDirectorySizeSync,
  getSiteSize,
  getVersionSize,
  siteHasContent,
  versionExists,
  formatBytes
};
