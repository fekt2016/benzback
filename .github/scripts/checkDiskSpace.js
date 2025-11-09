#!/usr/bin/env node

/**
 * Pre-Deployment Disk Space Check Script
 * 
 * Purpose:
 *   This script prevents "FTPError: 552 Disk full" by checking available disk space
 *   on the remote FTP server before attempting deployment. It can also attempt
 *   automatic cleanup of temporary files if disk space is low.
 * 
 * How it works:
 *   1. Connects to the FTP server using credentials from environment variables
 *   2. Attempts to upload a small test file (1KB) to check if disk space is available
 *   3. If upload fails with 552 error, disk is full
 *   4. Optionally attempts to clean up temporary files (logs, tmp, archives)
 *   5. Retries the test upload after cleanup
 *   6. Exits with error if disk is still full after cleanup
 * 
 * Why this is needed:
 *   - Prevents deployment failures due to insufficient disk space
 *   - Provides early warning before attempting large file uploads
 *   - Can automatically free up space by removing temporary files
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

// Test file name for disk space check
const TEST_FILE_NAME = "disk_test.txt";
const TEST_FILE_SIZE = 1024; // 1KB test file

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

/**
 * Create a temporary test file
 */
function createTestFile() {
  const testContent = Buffer.alloc(TEST_FILE_SIZE, "0");
  fs.writeFileSync(TEST_FILE_NAME, testContent);
  return TEST_FILE_NAME;
}

/**
 * Delete the temporary test file
 */
function deleteTestFile() {
  try {
    if (fs.existsSync(TEST_FILE_NAME)) {
      fs.unlinkSync(TEST_FILE_NAME);
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Attempt to clean up temporary files on the FTP server
 */
async function cleanupTempFiles(client, baseDir) {
  log("🧹 Attempting to free up disk space...", "cyan");
  
  const cleanupPaths = [
    "logs",
    "tmp",
    ".tmp",
    "node_modules/.cache",
  ];
  
  const cleanupPatterns = [
    "*.log",
    "*.tmp",
    "*.zip",
    "*.tar.gz",
    "*.cache",
  ];
  
  let deletedCount = 0;
  let freedSpace = 0;
  
  try {
    // Try to remove common temporary directories
    for (const dir of cleanupPaths) {
      const remotePath = path.posix.join(baseDir, dir).replace(/\\/g, "/");
      try {
        // Try to list the directory first
        const files = await client.list(remotePath);
        if (files && files.length > 0) {
          log(`  📂 Found ${dir}/ directory with ${files.length} items`, "yellow");
          
          // Try to remove files in the directory
          for (const file of files) {
            if (file.type === 1) { // File
              const filePath = path.posix.join(remotePath, file.name).replace(/\\/g, "/");
              try {
                await client.remove(filePath);
                log(`🧹 Deleted ${filePath}`, "green");
                deletedCount++;
                freedSpace += file.size || 0;
              } catch (error) {
                // Ignore individual file deletion errors
              }
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be accessed, skip
      }
    }
    
    // Try to remove files matching patterns in base directory
    try {
      const baseFiles = await client.list(baseDir);
      for (const file of baseFiles) {
        if (file.type === 1) { // File
          const fileName = file.name.toLowerCase();
          const shouldDelete = cleanupPatterns.some(pattern => {
            const regex = new RegExp(pattern.replace("*", ".*"));
            return regex.test(fileName);
          });
          
          if (shouldDelete && file.name !== TEST_FILE_NAME) {
            const filePath = path.posix.join(baseDir, file.name).replace(/\\/g, "/");
            try {
              await client.remove(filePath);
              log(`🧹 Deleted ${filePath}`, "green");
              deletedCount++;
              freedSpace += file.size || 0;
            } catch (error) {
              // Ignore individual file deletion errors
            }
          }
        }
      }
    } catch (error) {
      // Can't list base directory, skip
    }
    
    if (deletedCount > 0) {
      const freedMB = (freedSpace / 1024 / 1024).toFixed(2);
      log(`  ✅ Cleaned up ${deletedCount} files (~${freedMB}MB)`, "green");
    } else {
      log(`  ℹ️  No temporary files found to clean up`, "yellow");
    }
  } catch (error) {
    log(`  ⚠️  Cleanup error: ${error.message}`, "yellow");
  }
  
  return { deletedCount, freedSpace };
}

/**
 * Check disk space by attempting to upload a test file
 */
async function checkDiskSpace() {
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
  
  log("💾 Checking remote disk space...", "cyan");
  log(`📁 Target directory: ${ftpDir}`, "blue");
  log(`🌐 FTP Server: ${ftpServer}`, "blue");
  log("");
  
  // Create test file
  const testFile = createTestFile();
  
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
      await client.cd(ftpDir);
    }
    log("");
    
    // Attempt to upload test file
    log("📤 Testing disk space by uploading 1KB test file...", "cyan");
    let uploadSuccess = false;
    let attemptCount = 0;
    const maxAttempts = 2; // Try once, then cleanup and retry
    
    while (!uploadSuccess && attemptCount < maxAttempts) {
      attemptCount++;
      
      try {
        await client.uploadFrom(testFile, TEST_FILE_NAME);
        log(`✅ Enough disk space`, "green");
        uploadSuccess = true;
        
        // Clean up test file
        try {
          await client.remove(TEST_FILE_NAME);
          log(`✅ Test file removed`, "green");
        } catch (removeError) {
          log(`⚠️  Warning: Could not remove test file: ${removeError.message}`, "yellow");
        }
      } catch (uploadError) {
        const errorMessage = uploadError.message || "";
        const errorCode = uploadError.code || "";
        
        // Check if it's a disk full error (552)
        if (errorCode === "552" || errorMessage.includes("552") || errorMessage.includes("Disk full") || errorMessage.includes("No space")) {
          log(`❌ Disk full on server`, "red");
          log(`   Error: ${errorMessage}`, "red");
          
          if (attemptCount < maxAttempts) {
            log("", "reset");
            // Attempt cleanup
            const cleanupResult = await cleanupTempFiles(client, ftpDir);
            log("");
            
            if (cleanupResult.deletedCount > 0) {
              log("🔄 Retrying disk space check after cleanup...", "cyan");
              log("");
              // Wait a moment for filesystem to update
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              log("⚠️  No files were cleaned up. Disk may be genuinely full.", "yellow");
            }
          } else {
            log("", "reset");
            log("❌ Disk is still full after cleanup attempt", "red");
            log("", "reset");
            log("🔧 Manual intervention required:", "yellow");
            log("  1. Log into cPanel File Manager", "yellow");
            log("  2. Delete unnecessary files (logs, temp files, old backups)", "yellow");
            log("  3. Check disk usage in cPanel → Disk Usage", "yellow");
            log("  4. Consider upgrading hosting plan if consistently full", "yellow");
            log("", "reset");
            
            client.close();
            deleteTestFile();
            process.exit(1);
          }
        } else {
          // Different error, not disk full
          log(`❌ Upload failed with different error: ${errorMessage}`, "red");
          log(`   Error code: ${errorCode}`, "red");
          log("", "reset");
          log("🔧 This may be a permissions or connectivity issue:", "yellow");
          log("  1. Verify FTP credentials are correct", "yellow");
          log("  2. Check FTP user has write permissions", "yellow");
          log("  3. Verify server directory path is correct", "yellow");
          log("", "reset");
          
          client.close();
          deleteTestFile();
          process.exit(1);
        }
      }
    }
    
    if (uploadSuccess) {
      log("");
      log("✅ Disk space check passed - enough space available for deployment", "green");
      log("");
    }
    
    // Close FTP connection
    client.close();
    deleteTestFile();
    process.exit(0);
  } catch (error) {
    log("", "reset");
    log("❌ Disk Space Check Failed", "red");
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
    
    deleteTestFile();
    process.exit(1);
  }
}

// Run the disk space check
checkDiskSpace().catch((error) => {
  log("❌ Unexpected error:", "red");
  log(error.message, "red");
  if (error.stack) {
    log(error.stack, "red");
  }
  deleteTestFile();
  process.exit(1);
});

