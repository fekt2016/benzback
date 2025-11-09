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
    
    // Memory monitoring in production (store interval reference for cleanup)
    let memoryMonitorInterval = null;
    if (process.env.NODE_ENV === "production") {
      memoryMonitorInterval = setInterval(() => {
        const used = process.memoryUsage();
        const heapUsedMB = (used.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotalMB = (used.heapTotal / 1024 / 1024).toFixed(2);
        const rssMB = (used.rss / 1024 / 1024).toFixed(2);
        
        // Log if memory usage is high (1.5GB threshold for 2GB limit, with CloudLinux LVE 4GB cap)
        // WebAssembly (undici) uses memory outside heap, so we need lower threshold
        if (used.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB threshold (75% of 2GB, leaves room for WebAssembly)
          console.warn(`⚠️  High memory usage: Heap ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB`);
          console.warn(`⚠️  Memory is approaching 4GB limit. Consider optimizing or scaling.`);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
            const afterGC = process.memoryUsage();
            console.log(`🧹 GC ran. Memory after: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`);
          }
        } else {
          console.log(`💾 Memory: Heap ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB`);
        }
      }, 60000); // Every minute
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
