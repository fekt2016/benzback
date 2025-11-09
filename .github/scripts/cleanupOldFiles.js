#!/usr/bin/env node

/**
 * Pre-Deployment Remote File Cleanup Script
 * 
 * Purpose:
 *   This script automatically cleans up old files and directories on the remote FTP server
 *   before deployment to prevent "FTPError: 552 Disk full" errors.
 * 
 * How it works:
 *   1. Connects to the FTP server using credentials from environment variables
 *   2. Safely deletes old directories (node_modules, logs, tmp, temp)
 *   3. Removes old archive files (*.zip, *.tar.gz, *.bak, *.log)
 *   4. Logs what was deleted and what was skipped
 *   5. Never fails the build (exits gracefully even on errors)
 * 
 * Safety:
 *   - Only deletes safe-to-remove files (node_modules can be reinstalled)
 *   - Never deletes source code or configuration files
 *   - Continues even if some deletions fail
 *   - Always exits with code 0 (success)
 */

const ftp = require("basic-ftp");
const path = require("path");

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

// Directories to clean up (safe to remove, can be regenerated)
const DIRECTORIES_TO_CLEAN = [
  "node_modules",
  "logs",
  "tmp",
  "temp",
  ".tmp",
  ".cache",
  "coverage",
  ".nyc_output",
];

// File patterns to clean up
const FILE_PATTERNS = [
  "*.zip",
  "*.tar.gz",
  "*.bak",
  "*.log",
  "*.cache",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "production-*.tar.gz",
  "production-*.zip",
  "Archive.zip",
];

/**
 * Safely remove a directory from FTP server
 */
async function removeDirectory(client, baseDir, dirName) {
  const remotePath = path.posix.join(baseDir, dirName).replace(/\\/g, "/");
  
  try {
    // Try to list the directory first to see if it exists
    const files = await client.list(remotePath);
    
    if (files && files.length > 0) {
      log(`  📂 Found ${dirName}/ directory with ${files.length} items`, "yellow");
      
      // Try to remove the entire directory
      // Note: basic-ftp doesn't have a direct removeDir, so we'll try to remove files first
      let removedCount = 0;
      let totalSize = 0;
      
      // Remove files in the directory
      for (const file of files) {
        if (file.type === 1) { // File
          const filePath = path.posix.join(remotePath, file.name).replace(/\\/g, "/");
          try {
            await client.remove(filePath);
            removedCount++;
            totalSize += file.size || 0;
          } catch (error) {
            // Ignore individual file errors, continue with others
          }
        } else if (file.type === 2) { // Directory
          // Recursively remove subdirectories (simplified - just log for now)
          const subDirPath = path.posix.join(remotePath, file.name).replace(/\\/g, "/");
          try {
            // Try to remove subdirectory files
            const subFiles = await client.list(subDirPath);
            for (const subFile of subFiles) {
              if (subFile.type === 1) {
                try {
                  await client.remove(path.posix.join(subDirPath, subFile.name).replace(/\\/g, "/"));
                  removedCount++;
                  totalSize += subFile.size || 0;
                } catch (error) {
                  // Ignore
                }
              }
            }
          } catch (error) {
            // Ignore subdirectory errors
          }
        }
      }
      
      // Try to remove the directory itself (if FTP server supports it)
      try {
        await client.removeDir(remotePath);
      } catch (error) {
        // Some FTP servers don't support removeDir, that's okay
        // We've already removed the files
      }
      
      const freedMB = (totalSize / 1024 / 1024).toFixed(2);
      log(`  ✅ Removed: ${dirName}/ (${removedCount} items, ~${freedMB}MB)`, "green");
      return { removed: true, count: removedCount, size: totalSize };
    } else {
      log(`  ⚠️  Skipped: ${dirName}/ (empty or not found)`, "yellow");
      return { removed: false, count: 0, size: 0 };
    }
  } catch (error) {
    // Directory doesn't exist or can't be accessed - that's okay
    log(`  ⚠️  Skipped: ${dirName}/ (${error.message.includes('not found') || error.message.includes('No such file') ? 'not found' : 'error accessing'})`, "yellow");
    return { removed: false, count: 0, size: 0 };
  }
}

/**
 * Remove files matching patterns in the base directory
 */
async function removeMatchingFiles(client, baseDir) {
  let removedCount = 0;
  let totalSize = 0;
  
  try {
    const baseFiles = await client.list(baseDir);
    
    for (const file of baseFiles) {
      if (file.type === 1) { // File only
        const fileName = file.name.toLowerCase();
        
        // Check if file matches any pattern
        const shouldDelete = FILE_PATTERNS.some(pattern => {
          // Convert pattern to regex
          const regexPattern = pattern
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");
          const regex = new RegExp(`^${regexPattern}$`, "i");
          return regex.test(fileName);
        });
        
        if (shouldDelete) {
          const filePath = path.posix.join(baseDir, file.name).replace(/\\/g, "/");
          try {
            await client.remove(filePath);
            removedCount++;
            totalSize += file.size || 0;
            log(`  ✅ Removed file: ${file.name}`, "green");
          } catch (error) {
            // Ignore individual file deletion errors
            log(`  ⚠️  Could not remove: ${file.name} (${error.message})`, "yellow");
          }
        }
      }
    }
    
    if (removedCount > 0) {
      const freedMB = (totalSize / 1024 / 1024).toFixed(2);
      log(`  ✅ Removed ${removedCount} matching files (~${freedMB}MB)`, "green");
    } else {
      log(`  ℹ️  No matching files found to remove`, "blue");
    }
  } catch (error) {
    log(`  ⚠️  Could not list base directory: ${error.message}`, "yellow");
  }
  
  return { removed: removedCount > 0, count: removedCount, size: totalSize };
}

/**
 * Main cleanup function
 */
async function cleanupOldFiles() {
  const client = new ftp.Client();
  client.ftp.verbose = false; // Set to true for detailed FTP debugging
  
  // Validate environment variables
  const ftpServer = process.env.FTP_SERVER || process.env.CPANEL_FTP_SERVER;
  const ftpUsername = process.env.FTP_USERNAME || process.env.CPANEL_FTP_USER;
  const ftpPassword = process.env.FTP_PASSWORD || process.env.CPANEL_FTP_PASS;
  const ftpDir = process.env.FTP_DIR || process.env.CPANEL_FTP_DIR || "public_html/myapp/backend";
  const ftpPort = parseInt(process.env.FTP_PORT || process.env.CPANEL_FTP_PORT || "21", 10);
  
  if (!ftpServer || !ftpUsername || !ftpPassword) {
    log("⚠️  Warning: Missing FTP credentials, skipping cleanup", "yellow");
    log("   This is not a fatal error - deployment will continue", "yellow");
    process.exit(0); // Exit successfully even without credentials
  }
  
  log("🧹 Cleaning up old files on FTP server...", "cyan");
  log(`📁 Target directory: ${ftpDir}`, "blue");
  log(`🌐 FTP Server: ${ftpServer}`, "blue");
  log("");
  
  let totalRemoved = 0;
  let totalFreed = 0;
  
  try {
    // Connect to FTP server
    log("🔌 Connecting to FTP server...", "cyan");
    await client.access({
      host: ftpServer,
      user: ftpUsername,
      password: ftpPassword,
      secure: false, // Use FTP (not FTPS/SFTP)
      port: ftpPort,
    });
    log("✅ Connected successfully", "green");
    log("");
    
    // Navigate to base directory
    log(`📂 Navigating to base directory: ${ftpDir}`, "cyan");
    try {
      await client.ensureDir(ftpDir);
      await client.cd(ftpDir);
      log(`✅ Base directory ready: ${ftpDir}`, "green");
    } catch (error) {
      log(`⚠️  Warning: Could not access base directory: ${error.message}`, "yellow");
      log("   Attempting to create base directory structure...", "yellow");
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
      try {
        await client.cd(ftpDir);
      } catch (e) {
        log(`⚠️  Could not navigate to ${ftpDir}, cleanup may be incomplete`, "yellow");
        log("   This is not a fatal error - deployment will continue", "yellow");
        client.close();
        process.exit(0); // Exit successfully
      }
    }
    log("");
    
    // Clean up directories
    log("🗂️  Cleaning up directories...", "cyan");
    for (const dir of DIRECTORIES_TO_CLEAN) {
      const result = await removeDirectory(client, ftpDir, dir);
      if (result.removed) {
        totalRemoved += result.count;
        totalFreed += result.size;
      }
    }
    log("");
    
    // Clean up matching files
    log("📄 Cleaning up matching files...", "cyan");
    const fileResult = await removeMatchingFiles(client, ftpDir);
    if (fileResult.removed) {
      totalRemoved += fileResult.count;
      totalFreed += fileResult.size;
    }
    log("");
    
    // Summary
    const totalFreedMB = (totalFreed / 1024 / 1024).toFixed(2);
    if (totalRemoved > 0) {
      log(`🎉 Cleanup completed successfully!`, "green");
      log(`   Removed ${totalRemoved} items (~${totalFreedMB}MB freed)`, "green");
    } else {
      log(`✅ Cleanup completed (no files to remove)`, "green");
    }
    
    // Close connection
    client.close();
    log("✅ FTP connection closed", "green");
    
  } catch (error) {
    // Never fail the build - log error and exit successfully
    log(`⚠️  Warning: Cleanup encountered an error: ${error.message}`, "yellow");
    log("   This is not a fatal error - deployment will continue", "yellow");
    log("   You may need to manually clean up disk space", "yellow");
    
    try {
      client.close();
    } catch (closeError) {
      // Ignore close errors
    }
  }
  
  // Always exit successfully (code 0)
  // This ensures the workflow continues even if cleanup has issues
  process.exit(0);
}

// Run cleanup
cleanupOldFiles().catch((error) => {
  log(`⚠️  Unexpected error: ${error.message}`, "yellow");
  log("   Deployment will continue despite cleanup error", "yellow");
  process.exit(0); // Always exit successfully
});

