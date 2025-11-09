#!/usr/bin/env node

/**
 * Pre-Deployment FTP Directory Verification Script (Dynamic Version)
 * 
 * Purpose:
 *   This script prevents "FTPError: 553 Can't open that file: No such file or directory"
 *   by automatically detecting all local project directories and ensuring they exist
 *   on the remote FTP server before deployment.
 * 
 * How it works:
 *   1. Dynamically scans the local project to find all directories
 *   2. Filters out ignored directories (node_modules, .git, etc.)
 *   3. Connects to the FTP server using credentials from environment variables
 *   4. Checks if each directory exists on the remote server
 *   5. Creates any missing directories with proper permissions (755)
 *   6. Logs the results for debugging
 * 
 * Why this is needed:
 *   - FTP-Deploy-Action may fail if target directories don't exist
 *   - cPanel FTP servers may not auto-create nested directories
 *   - Prevents deployment failures due to missing folder structure
 *   - Automatically adapts to project structure changes (no manual updates needed)
 * 
 * Ignored Directories:
 *   - node_modules, .git, .github, logs, tmp
 *   - Hidden folders starting with .
 *   - Directories deeper than 10 levels
 * 
 * Environment Variables Required:
 *   - FTP_SERVER: FTP server hostname (e.g., ftp.yourdomain.com)
 *   - FTP_USERNAME: FTP username
 *   - FTP_PASSWORD: FTP password
 *   - FTP_DIR: Base directory path (e.g., public_html/myapp)
 */

const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");

// Directories to ignore when scanning
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".github",
  "logs",
  "tmp",
  ".tmp",
  "deployment",
  ".vscode",
  ".idea",
  "coverage",
  ".nyc_output",
  "dist",
  "build",
];

// Maximum directory depth to scan (prevents infinite recursion)
const MAX_DEPTH = 10;

// Maximum number of folders to process (prevents excessive FTP operations)
const MAX_FOLDERS = 200;

// Delay between folder creation operations (ms) to avoid flooding FTP server
const FOLDER_CREATE_DELAY = 100;

// ANSI color codes for better log output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Recursively get all directories in the project
 * @param {string} baseDir - Base directory to scan
 * @param {string[]} ignore - List of directory names to ignore
 * @param {number} currentDepth - Current recursion depth
 * @param {string} rootDir - Root directory for relative path calculation
 * @returns {string[]} Array of relative directory paths
 */
function getAllDirs(baseDir, ignore = [], currentDepth = 0, rootDir = null) {
  if (rootDir === null) {
    rootDir = baseDir;
  }

  // Prevent infinite recursion
  if (currentDepth > MAX_DEPTH) {
    return [];
  }

  const dirs = [];

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip files, only process directories
      if (!entry.isDirectory()) {
        continue;
      }

      const dirName = entry.name;
      const fullPath = path.join(baseDir, dirName);
      const relPath = path.relative(rootDir, fullPath);

      // Skip hidden directories (starting with .)
      if (dirName.startsWith(".") && !dirName.startsWith("..")) {
        continue;
      }

      // Check if this directory should be ignored
      const shouldIgnore = ignore.some((ig) => {
        // Check if path starts with ignore pattern
        if (relPath.startsWith(ig)) {
          return true;
        }
        // Check if directory name matches ignore pattern
        if (dirName === ig) {
          return true;
        }
        // Check if any part of the path matches
        const pathParts = relPath.split(path.sep);
        return pathParts.includes(ig);
      });

      if (shouldIgnore) {
        continue;
      }

      // Add this directory
      dirs.push(relPath);

      // Recursively get subdirectories
      try {
        const subDirs = getAllDirs(fullPath, ignore, currentDepth + 1, rootDir);
        dirs.push(...subDirs);
      } catch (error) {
        // Skip directories we can't read (permissions, symlinks, etc.)
        log(`  ⚠️  Skipping ${relPath}: ${error.message}`, "yellow");
      }
    }
  } catch (error) {
    // Skip directories we can't read
    log(`  ⚠️  Cannot read ${baseDir}: ${error.message}`, "yellow");
  }

  return dirs;
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkAndCreateDirectories() {
  const client = new ftp.Client();
  client.ftp.verbose = false; // Set to true for detailed FTP debugging

  // Validate environment variables
  const ftpServer = process.env.FTP_SERVER || process.env.CPANEL_FTP_SERVER;
  const ftpUsername = process.env.FTP_USERNAME || process.env.CPANEL_FTP_USER;
  const ftpPassword = process.env.FTP_PASSWORD || process.env.CPANEL_FTP_PASS;
  const ftpDir = process.env.FTP_DIR || process.env.CPANEL_FTP_DIR || "public_html/myapp";

  if (!ftpServer || !ftpUsername || !ftpPassword) {
    log("❌ Error: Missing required FTP credentials", "red");
    log("Required environment variables:", "yellow");
    log("  - FTP_SERVER (or CPANEL_FTP_SERVER)", "yellow");
    log("  - FTP_USERNAME (or CPANEL_FTP_USER)", "yellow");
    log("  - FTP_PASSWORD (or CPANEL_FTP_PASS)", "yellow");
    log("  - FTP_DIR (or CPANEL_FTP_DIR) - optional, defaults to 'public_html/myapp'", "yellow");
    process.exit(1);
  }

  log("🔍 Starting FTP directory verification (Dynamic Mode)...", "cyan");
  log(`📁 Base directory: ${ftpDir}`, "blue");
  log(`🌐 FTP Server: ${ftpServer}`, "blue");
  log("");

  // Step 1: Dynamically discover all directories
  log("📂 Scanning local project for directories...", "cyan");
  const projectRoot = process.cwd();
  log(`   Project root: ${projectRoot}`, "gray");

  const allDirs = getAllDirs(projectRoot, IGNORE_DIRS);
  
  // Sort directories by depth (shallow first) to create parent dirs before children
  const sortedDirs = allDirs.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    return depthA - depthB;
  });

  // Remove duplicates
  const uniqueDirs = [...new Set(sortedDirs)];

  log(`   Found ${uniqueDirs.length} directories to verify`, "green");
  
  if (uniqueDirs.length > MAX_FOLDERS) {
    log(`   ⚠️  Warning: Found ${uniqueDirs.length} directories (limit: ${MAX_FOLDERS})`, "yellow");
    log(`   Processing first ${MAX_FOLDERS} directories...`, "yellow");
    uniqueDirs.splice(MAX_FOLDERS);
  }

  log("");
  log("📋 Directories to verify:", "cyan");
  uniqueDirs.slice(0, 20).forEach((dir) => {
    log(`   - ${dir}`, "gray");
  });
  if (uniqueDirs.length > 20) {
    log(`   ... and ${uniqueDirs.length - 20} more`, "gray");
  }
  log("");

  try {
    // Step 2: Connect to FTP server
    log("🔌 Connecting to FTP server...", "cyan");
    await client.access({
      host: ftpServer,
      user: ftpUsername,
      password: ftpPassword,
      secure: false, // Use FTP (not FTPS/SFTP)
      port: parseInt(process.env.FTP_PORT || process.env.CPANEL_FTP_PORT || "21", 10),
    });
    log("✅ Connected successfully", "green");
    log("");

    // Step 3: Navigate to base directory (create if it doesn't exist)
    log(`📂 Navigating to base directory: ${ftpDir}`, "cyan");
    try {
      await client.ensureDir(ftpDir);
      log(`✅ Base directory ready: ${ftpDir}`, "green");
    } catch (error) {
      log(`⚠️  Warning: Could not access base directory: ${error.message}`, "yellow");
      log("   Attempting to create base directory structure...", "yellow");
      // Try to create the full path
      const dirParts = ftpDir.split("/").filter(Boolean);
      let currentPath = "";
      for (const part of dirParts) {
        currentPath += "/" + part;
        try {
          await client.ensureDir(currentPath);
        } catch (e) {
          // Ignore errors if directory already exists
        }
      }
    }
    log("");

    // Step 4: Check and create each directory
    log("📋 Verifying directories on remote server...", "cyan");
    log("");

    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < uniqueDirs.length; i++) {
      const folder = uniqueDirs[i];
      const remotePath = path.posix.join(ftpDir, folder).replace(/\\/g, "/");

      // Skip empty paths or root
      if (!folder || folder === "." || folder === "..") {
        skippedCount++;
        continue;
      }

      try {
        // Try to list the directory to check if it exists
        try {
          await client.list(remotePath);
          if (i < 10 || createdCount + existingCount < 20) {
            // Only log first few to avoid spam
            log(`  ✔ Exists: ${folder}`, "green");
          }
          existingCount++;
        } catch (listError) {
          // Directory doesn't exist, create it
          try {
            await client.ensureDir(remotePath);
            log(`  ✅ Created: ${folder}`, "green");
            createdCount++;

            // Try to set permissions (755) - some FTP servers support this
            try {
              // Use SITE CHMOD command if supported
              await client.send(`SITE CHMOD 755 ${remotePath}`, false);
              if (createdCount <= 5) {
                // Only log first few
                log(`     → Set permissions to 755`, "blue");
              }
            } catch (chmodError) {
              // CHMOD not supported, that's okay - permissions may be set by server
            }

            // Small delay to avoid flooding FTP server
            if (i < uniqueDirs.length - 1) {
              await sleep(FOLDER_CREATE_DELAY);
            }
          } catch (createError) {
            log(`  ❌ Failed to create: ${folder}`, "red");
            log(`     Error: ${createError.message}`, "red");
            errorCount++;
          }
        }
      } catch (error) {
        log(`  ❌ Error checking: ${folder}`, "red");
        log(`     Error: ${error.message}`, "red");
        errorCount++;
      }

      // Progress indicator for large directories
      if ((i + 1) % 50 === 0) {
        log(`   Progress: ${i + 1}/${uniqueDirs.length} directories processed...`, "gray");
      }
    }

    log("");
    log("📊 Summary:", "cyan");
    log(`  ✅ Created: ${createdCount} folders`, createdCount > 0 ? "green" : "reset");
    log(`  ✔ Existing: ${existingCount} folders`, "green");
    log(`  ⏭️  Skipped: ${skippedCount} folders`, skippedCount > 0 ? "yellow" : "reset");
    if (errorCount > 0) {
      log(`  ❌ Errors: ${errorCount} folders`, "red");
    }
    log(`  📦 Total: ${uniqueDirs.length} folders processed`, "blue");

    // Close FTP connection
    client.close();
    log("");
    log("✅ FTP directory verification completed", "green");

    // Exit with error code if there were failures
    if (errorCount > 0) {
      log("⚠️  Some folders could not be created. Deployment may fail.", "yellow");
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    log("", "reset");
    log("❌ FTP Directory Verification Failed", "red");
    log("", "reset");
    log("Error details:", "yellow");
    log(`  ${error.message}`, "red");
    log("", "reset");
    log("Troubleshooting:", "yellow");
    log("  1. Verify FTP credentials in GitHub Secrets", "yellow");
    log("  2. Check FTP server is accessible", "yellow");
    log("  3. Verify base directory path (FTP_DIR) is correct", "yellow");
    log("  4. Check FTP user has write permissions", "yellow");
    log("", "reset");

    try {
      client.close();
    } catch (closeError) {
      // Ignore close errors
    }

    process.exit(1);
  }
}

// Run the verification
checkAndCreateDirectories().catch((error) => {
  log("❌ Unexpected error:", "red");
  log(error.message, "red");
  if (error.stack) {
    log(error.stack, "red");
  }
  process.exit(1);
});
