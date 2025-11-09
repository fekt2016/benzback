#!/usr/bin/env node

/**
 * Pre-Deployment FTP Directory Verification Script
 * 
 * Purpose:
 *   This script prevents "FTPError: 553 Can't open that file: No such file or directory"
 *   by verifying and creating all required remote directories on the cPanel FTP server
 *   before the main deployment step runs.
 * 
 * How it works:
 *   1. Connects to the FTP server using credentials from environment variables
 *   2. Checks if required directories exist on the remote server
 *   3. Creates any missing directories with proper permissions (755)
 *   4. Logs the results for debugging
 * 
 * Why this is needed:
 *   - FTP-Deploy-Action may fail if target directories don't exist
 *   - cPanel FTP servers may not auto-create nested directories
 *   - Prevents deployment failures due to missing folder structure
 * 
 * How to add new folders:
 *   Simply add the folder name to the `requiredFolders` array below.
 *   The script will automatically check and create it if missing.
 * 
 * Environment Variables Required:
 *   - FTP_SERVER: FTP server hostname (e.g., ftp.yourdomain.com)
 *   - FTP_USERNAME: FTP username
 *   - FTP_PASSWORD: FTP password
 *   - FTP_DIR: Base directory path (e.g., public_html/myapp)
 */

const ftp = require("basic-ftp");
const path = require("path");

// Required folders that must exist on the remote server
// Add new folder names here as your project grows
const requiredFolders = [
  "controllers",
  "models",
  "routes",
  "middleware",
  "services",
  "socket",
  "utils",
  "config",
  "validators",
];

// ANSI color codes for better log output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

  log("🔍 Starting FTP directory verification...", "cyan");
  log(`📁 Base directory: ${ftpDir}`, "blue");
  log(`🌐 FTP Server: ${ftpServer}`, "blue");
  log("");

  try {
    // Connect to FTP server
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

    // Navigate to base directory (create if it doesn't exist)
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

    // Check and create each required folder
    log("📋 Checking required folders...", "cyan");
    log("");

    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const folder of requiredFolders) {
      const remotePath = path.posix.join(ftpDir, folder).replace(/\\/g, "/");

      try {
        // Try to list the directory to check if it exists
        try {
          await client.list(remotePath);
          log(`  ✔ Folder exists: ${folder}`, "green");
          existingCount++;
        } catch (listError) {
          // Directory doesn't exist, create it
          try {
            await client.ensureDir(remotePath);
            log(`  ✅ Created missing folder: ${folder}`, "green");
            createdCount++;

            // Try to set permissions (755) - some FTP servers support this
            try {
              // Use SITE CHMOD command if supported
              await client.send(`SITE CHMOD 755 ${remotePath}`, false);
              log(`     → Set permissions to 755`, "blue");
            } catch (chmodError) {
              // CHMOD not supported, that's okay - permissions may be set by server
              log(`     → Permissions set by server (CHMOD not supported)`, "blue");
            }
          } catch (createError) {
            log(`  ❌ Failed to create folder: ${folder}`, "red");
            log(`     Error: ${createError.message}`, "red");
            errorCount++;
          }
        }
      } catch (error) {
        log(`  ❌ Error checking folder: ${folder}`, "red");
        log(`     Error: ${error.message}`, "red");
        errorCount++;
      }
    }

    log("");
    log("📊 Summary:", "cyan");
    log(`  ✅ Created: ${createdCount} folders`, createdCount > 0 ? "green" : "reset");
    log(`  ✔ Existing: ${existingCount} folders`, "green");
    if (errorCount > 0) {
      log(`  ❌ Errors: ${errorCount} folders`, "red");
    }

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
  log(error.stack, "red");
  process.exit(1);
});

