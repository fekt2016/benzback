const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { validateEnv } = require("./utils/validateEnv");
const app = require("./app");

// Load environment variables FIRST
dotenv.config({ path: "./config.env" });

// CRITICAL: Force memory settings for cPanel (if not already set)
// cPanel often ignores NODE_OPTIONS, so we check and warn
const v8 = require('v8');
const heapLimit = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;

// Log Node.js options for debugging (especially important for cPanel)
// Reduced to 1.5GB minimum to leave room for WebAssembly (undici) which allocates outside V8 heap
const MIN_REQUIRED_MEMORY = 1536; // Minimum 1.5GB required (leaves 2.5GB for WebAssembly/system)

if (process.env.NODE_OPTIONS) {
  console.log(`✅ NODE_OPTIONS: ${process.env.NODE_OPTIONS}`);
} else {
  console.error(`❌ CRITICAL: NODE_OPTIONS not set!`);
  console.error(`❌ This will cause "Out of memory" errors in cPanel.`);
  console.error(`❌ SOLUTION: Use start.sh as the startup file in cPanel Node.js App settings.`);
  console.error(`❌ See CPANEL_CRITICAL_FIX.md for detailed instructions.`);
}

console.log(`📋 Node.js version: ${process.version}`);
console.log(`📋 Current max memory: ${heapLimit.toFixed(2)}MB`);

// MEMORY OPTIMIZATION: Check if memory flags are not applied (heap too high)
// Expected heap limit should be ~2048MB (2GB), but default Node.js gives ~4GB
const MAX_EXPECTED_MEMORY = 2560; // 2.5GB - if above this, flags likely not applied
const TARGET_MEMORY = 2048; // 2GB target

if (heapLimit > MAX_EXPECTED_MEMORY) {
  console.error(`\n❌ CRITICAL: Memory flags NOT applied!`);
  console.error(`❌ Current memory limit: ${heapLimit.toFixed(2)}MB (too high!)`);
  console.error(`❌ Expected limit: ~${TARGET_MEMORY}MB (2GB)`);
  console.error(`❌ This indicates Node.js memory flags are NOT being used!`);
  console.error(`\n🔧 IMMEDIATE FIX REQUIRED:`);
  console.error(`1. In cPanel → Node.js App → Set "Startup File" to: start.sh`);
  console.error(`2. Verify environment variable exists: NODE_OPTIONS=--max-old-space-size=2048 --expose-gc`);
  console.error(`3. RESTART your app (memory flags only apply on startup)`);
  console.error(`4. After restart, you should see: "Current max memory: ~2048.00MB"`);
  console.error(`\n📖 See CPANEL_FIX_STEPS.md for step-by-step instructions.\n`);
  
  // Don't exit in development, but warn heavily
  if (process.env.NODE_ENV === 'production') {
    console.error(`⚠️  WARNING: Running with default memory limit. This may cause crashes!`);
    console.error(`⚠️  The server will continue, but you MUST fix this before production use.`);
  }
}

// Check if memory is too low
if (heapLimit < MIN_REQUIRED_MEMORY) {
  console.error(`\n❌ CRITICAL MEMORY ERROR:`);
  console.error(`❌ Current memory limit: ${heapLimit.toFixed(2)}MB`);
  console.error(`❌ Required minimum: ${MIN_REQUIRED_MEMORY}MB`);
  console.error(`❌ Your server will crash with "Out of memory" errors!`);
  console.error(`\n🔧 IMMEDIATE FIX REQUIRED:`);
  console.error(`1. In cPanel → Node.js App → Set "Startup File" to: start.sh`);
  console.error(`2. Add environment variable: NODE_OPTIONS=--max-old-space-size=2048 --expose-gc`);
  console.error(`3. Restart your app`);
  console.error(`\n📖 See CPANEL_FIX_STEPS.md for step-by-step instructions.\n`);
  
  // Don't exit in development, but warn heavily
  if (process.env.NODE_ENV === 'production') {
    console.error(`❌ Exiting to prevent crashes. Fix the memory settings and restart.`);
    process.exit(1);
  }
}

// Success message if memory is in correct range
if (heapLimit >= MIN_REQUIRED_MEMORY && heapLimit <= MAX_EXPECTED_MEMORY) {
  console.log(`✅ Memory limit is correctly set: ${heapLimit.toFixed(2)}MB (target: ${TARGET_MEMORY}MB)`);
}

// Validate environment variables
validateEnv();

// Handle uncaught exceptions (synchronous errors)
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections (asynchronous errors)
process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);
  // Give server time to finish current requests
  process.exit(1);
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const startServer = async () => {
  try {
    // Validate required environment variables
    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL is not defined in environment variables");
    }
    if (!process.env.MONGO_PASSWORD) {
      throw new Error("MONGO_PASSWORD is not defined in environment variables");
    }

    const db = process.env.MONGO_URL.replace(
      `<PASSWORD>`,
      process.env.MONGO_PASSWORD
    );
    
    // MongoDB connection with better error handling
    // Reduced maxPoolSize to 5 for lower memory usage (was 10)
    const conn = await mongoose.connect(db, {
      maxPoolSize: 5, // Reduced from 10 to save memory
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Start Express server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    });

    // Initialize Socket.io
    const { initializeSocket } = require("./socket/socketServer");
    const io = initializeSocket(server);
    app.set("io", io); // Make io available to routes/controllers
    console.log(`🔌 Socket.io initialized`);
    
    // MEMORY OPTIMIZATION: Use dedicated memory monitoring utility
    // This provides better memory tracking and only logs when needed
    let memoryMonitorInterval = null;
    if (process.env.NODE_ENV === "production") {
      const { startMemoryMonitoring } = require("./utils/memoryMonitor");
      // Monitor every 10 minutes, log only when heap exceeds 1.5GB
      // This reduces log noise and memory overhead from frequent monitoring
      memoryMonitorInterval = startMemoryMonitoring({
        intervalMs: 600000, // 10 minutes (reduced from 1 minute to save CPU/memory)
        heapThresholdMB: 1500, // 1.5GB threshold (75% of 2GB limit)
        logAlways: false, // Only log when threshold exceeded
      });
      console.log("✅ Memory monitoring started (logs every 10 minutes or when threshold exceeded)");
    }
    
    // Graceful shutdown
    let shutdownTimeout = null;
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      // Clear memory monitoring interval
      if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
      }
      
      // Stop accepting new connections
      server.close(() => {
        console.log("✅ HTTP server closed.");
        
        // Close database connection
        mongoose.connection.close(false).then(() => {
          console.log("✅ MongoDB connection closed.");
          // Clear shutdown timeout if still pending
          if (shutdownTimeout) {
            clearTimeout(shutdownTimeout);
          }
          process.exit(0);
        }).catch((err) => {
          console.error("❌ Error closing MongoDB connection:", err);
          if (shutdownTimeout) {
            clearTimeout(shutdownTimeout);
          }
          process.exit(1);
        });
      });
      
      // Force close after 10 seconds
      shutdownTimeout = setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Server startup error:", err);
    process.exit(1);
  }
};

startServer();
