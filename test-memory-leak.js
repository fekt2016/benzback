/**
 * Memory Leak Detection Script
 * 
 * This script monitors memory usage over time to detect potential leaks.
 * Run with: NODE_ENV=production node --max-old-space-size=8192 --expose-gc test-memory-leak.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: "./config.env" });

// Track memory usage over time
const memoryHistory = [];
let testStartTime = Date.now();
let intervalCount = 0;
const MAX_INTERVALS = 5; // Run for 5 minutes (5 intervals of 1 minute) - Change to 30 for full test

// Memory leak detection thresholds
const LEAK_THRESHOLD_MB = 50; // If memory grows by more than 50MB per minute, it's a leak
const MAX_MEMORY_MB = 1000; // Alert if memory exceeds 1GB

function formatMemory(memoryUsage) {
  return {
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
    external: (memoryUsage.external / 1024 / 1024).toFixed(2) + " MB",
  };
}

function detectLeak(current, previous) {
  if (!previous) return null;
  
  const heapUsedDiff = current.heapUsed - previous.heapUsed;
  const rssDiff = current.rss - previous.rss;
  
  const leak = {
    heapLeak: heapUsedDiff > LEAK_THRESHOLD_MB * 1024 * 1024,
    rssLeak: rssDiff > LEAK_THRESHOLD_MB * 1024 * 1024,
    heapUsedDiffMB: (heapUsedDiff / 1024 / 1024).toFixed(2),
    rssDiffMB: (rssDiff / 1024 / 1024).toFixed(2),
  };
  
  return leak;
}

function logMemoryStatus() {
  const memory = process.memoryUsage();
  const formatted = formatMemory(memory);
  const elapsed = ((Date.now() - testStartTime) / 1000 / 60).toFixed(2);
  
  console.log(`\n⏱️  [${elapsed} min] Memory Status:`);
  console.log(`   Heap Used: ${formatted.heapUsed}`);
  console.log(`   Heap Total: ${formatted.heapTotal}`);
  console.log(`   RSS: ${formatted.rss}`);
  console.log(`   External: ${formatted.external}`);
  
  // Store in history
  memoryHistory.push({
    time: Date.now(),
    memory: memory,
    formatted: formatted,
  });
  
  // Detect leaks
  if (memoryHistory.length > 1) {
    const previous = memoryHistory[memoryHistory.length - 2].memory;
    const leak = detectLeak(memory, previous);
    
    if (leak) {
      if (leak.heapLeak || leak.rssLeak) {
        console.log(`   ⚠️  POTENTIAL LEAK DETECTED!`);
        console.log(`   Heap growth: ${leak.heapUsedDiffMB} MB`);
        console.log(`   RSS growth: ${leak.rssDiffMB} MB`);
      } else {
        console.log(`   ✅ Memory stable (Heap: ${leak.heapUsedDiffMB} MB, RSS: ${leak.rssDiffMB} MB)`);
      }
    }
  }
  
  // Check for high memory usage
  const heapUsedMB = parseFloat(formatted.heapUsed);
  if (heapUsedMB > MAX_MEMORY_MB) {
    console.log(`   🔴 HIGH MEMORY USAGE: ${heapUsedMB.toFixed(2)} MB exceeds ${MAX_MEMORY_MB} MB threshold!`);
  }
  
  // Force GC if available
  if (global.gc && intervalCount % 5 === 0) {
    console.log(`   🧹 Running garbage collection...`);
    global.gc();
    const afterGC = process.memoryUsage();
    const afterFormatted = formatMemory(afterGC);
    console.log(`   After GC - Heap Used: ${afterFormatted.heapUsed}`);
  }
  
  intervalCount++;
  
  // Generate summary if we've collected enough data
  if (memoryHistory.length >= 5) {
    const first = memoryHistory[0].memory;
    const last = memoryHistory[memoryHistory.length - 1].memory;
    const totalGrowth = (last.heapUsed - first.heapUsed) / 1024 / 1024;
    const avgGrowthPerMin = totalGrowth / memoryHistory.length;
    
    console.log(`\n   📊 Summary (${memoryHistory.length} intervals):`);
    console.log(`   Total heap growth: ${totalGrowth.toFixed(2)} MB`);
    console.log(`   Average growth per minute: ${avgGrowthPerMin.toFixed(2)} MB`);
    
    if (avgGrowthPerMin > 10) {
      console.log(`   ⚠️  WARNING: Average growth of ${avgGrowthPerMin.toFixed(2)} MB/min suggests a memory leak!`);
    } else if (avgGrowthPerMin > 0) {
      console.log(`   ✅ Memory growth is within acceptable limits`);
    } else {
      console.log(`   ✅ Memory is stable or decreasing (good!)`);
    }
  }
}

async function testDatabaseConnection() {
  try {
    if (!process.env.MONGO_URL || !process.env.MONGO_PASSWORD) {
      console.log("⚠️  MongoDB credentials not found. Skipping database connection test.");
      return null;
    }
    
    const db = process.env.MONGO_URL.replace(
      `<PASSWORD>`,
      process.env.MONGO_PASSWORD
    );
    
    const conn = await mongoose.connect(db, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.log(`⚠️  Could not connect to MongoDB: ${error.message}`);
    return null;
  }
}

async function simulateRequests() {
  // Simulate some operations that might cause leaks
  const operations = [];
  
  // Simulate array accumulation (common leak pattern)
  for (let i = 0; i < 100; i++) {
    operations.push({
      id: i,
      data: new Array(1000).fill(0).map((_, j) => ({ index: j, value: Math.random() })),
      timestamp: Date.now(),
    });
  }
  
  // Clear operations to prevent actual leak
  operations.length = 0;
  
  // Simulate event listeners (if any)
  // This would be tested in actual server code
  
  return operations.length;
}

async function main() {
  console.log("🔍 Starting Memory Leak Detection Test");
  console.log("=" .repeat(50));
  console.log(`Node.js version: ${process.version}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
  console.log(`Max old space size: ${require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024} MB`);
  console.log(`GC available: ${global.gc ? "Yes" : "No (run with --expose-gc)"}`);
  console.log("=" .repeat(50));
  
  // Initial memory snapshot
  console.log("\n📸 Initial Memory Snapshot:");
  logMemoryStatus();
  
  // Test database connection
  const dbConnection = await testDatabaseConnection();
  
  // Simulate some operations
  console.log("\n🔄 Simulating operations...");
  await simulateRequests();
  
  // Monitor memory every minute
  console.log(`\n⏳ Monitoring memory for ${MAX_INTERVALS} minutes...`);
  console.log("   (Press Ctrl+C to stop early)\n");
  
  const monitorInterval = setInterval(() => {
    logMemoryStatus();
    
    if (intervalCount >= MAX_INTERVALS) {
      console.log("\n✅ Test completed!");
      generateFinalReport();
      clearInterval(monitorInterval);
      if (dbConnection) {
        mongoose.connection.close();
      }
      process.exit(0);
    }
  }, 60000); // Every minute
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Test interrupted by user");
    generateFinalReport();
    clearInterval(monitorInterval);
    if (dbConnection) {
      mongoose.connection.close();
    }
    process.exit(0);
  });
}

function generateFinalReport() {
  if (memoryHistory.length < 2) {
    console.log("\n⚠️  Not enough data collected for analysis");
    return;
  }
  
  const first = memoryHistory[0].memory;
  const last = memoryHistory[memoryHistory.length - 1].memory;
  const duration = (last.time - first.time) / 1000 / 60; // minutes
  
  const heapGrowth = (last.heapUsed - first.heapUsed) / 1024 / 1024;
  const rssGrowth = (last.rss - first.rss) / 1024 / 1024;
  const avgHeapGrowthPerMin = heapGrowth / duration;
  const avgRssGrowthPerMin = rssGrowth / duration;
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL MEMORY LEAK ANALYSIS REPORT");
  console.log("=".repeat(50));
  console.log(`Test Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Data Points Collected: ${memoryHistory.length}`);
  console.log("\n📈 Memory Growth:");
  console.log(`   Heap Used: ${formatMemory(first).heapUsed} → ${formatMemory(last).heapUsed} (${heapGrowth >= 0 ? "+" : ""}${heapGrowth.toFixed(2)} MB)`);
  console.log(`   RSS: ${formatMemory(first).rss} → ${formatMemory(last).rss} (${rssGrowth >= 0 ? "+" : ""}${rssGrowth.toFixed(2)} MB)`);
  console.log(`\n📊 Average Growth Rate:`);
  console.log(`   Heap: ${avgHeapGrowthPerMin >= 0 ? "+" : ""}${avgHeapGrowthPerMin.toFixed(2)} MB/min`);
  console.log(`   RSS: ${avgRssGrowthPerMin >= 0 ? "+" : ""}${avgRssGrowthPerMin.toFixed(2)} MB/min`);
  
  // Determine if there's a leak
  console.log("\n🔍 Leak Detection Result:");
  if (avgHeapGrowthPerMin > 10 || avgRssGrowthPerMin > 10) {
    console.log("   🔴 MEMORY LEAK DETECTED!");
    console.log("   ⚠️  Memory is growing at an unsustainable rate.");
    console.log("   🔧 Action Required: Review code for:");
    console.log("      - Unclosed timers (setInterval, setTimeout)");
    console.log("      - Event listeners not removed");
    console.log("      - Unbounded arrays/objects");
    console.log("      - Database connections not closed");
    console.log("      - Cached data growing unbounded");
  } else if (avgHeapGrowthPerMin > 5 || avgRssGrowthPerMin > 5) {
    console.log("   🟡 POTENTIAL MEMORY ISSUE");
    console.log("   ⚠️  Memory growth is higher than expected.");
    console.log("   💡 Recommendation: Monitor in production and investigate if growth continues.");
  } else if (avgHeapGrowthPerMin > 0 || avgRssGrowthPerMin > 0) {
    console.log("   🟢 MINOR GROWTH (Acceptable)");
    console.log("   ✅ Memory growth is within acceptable limits.");
    console.log("   💡 This is normal for applications with caching or connection pooling.");
  } else {
    console.log("   ✅ NO MEMORY LEAK DETECTED");
    console.log("   🎉 Memory is stable or decreasing. Excellent!");
  }
  
  console.log("\n" + "=".repeat(50));
}

// Run the test
main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

