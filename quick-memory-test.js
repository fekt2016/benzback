/**
 * Quick Memory Leak Test (2 minutes)
 * Run: NODE_ENV=production node --max-old-space-size=8192 --expose-gc quick-memory-test.js
 */

const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const memoryHistory = [];
let intervalCount = 0;
const MAX_INTERVALS = 2; // 2 minutes for quick test

function formatMemory(memoryUsage) {
  return {
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
  };
}

function logMemoryStatus() {
  const memory = process.memoryUsage();
  const formatted = formatMemory(memory);
  
  console.log(`\n⏱️  [Interval ${intervalCount + 1}] Memory Status:`);
  console.log(`   Heap Used: ${formatted.heapUsed}`);
  console.log(`   Heap Total: ${formatted.heapTotal}`);
  console.log(`   RSS: ${formatted.rss}`);
  
  memoryHistory.push({
    time: Date.now(),
    memory: memory,
  });
  
  // Detect leaks
  if (memoryHistory.length > 1) {
    const previous = memoryHistory[memoryHistory.length - 2].memory;
    const heapUsedDiff = (memory.heapUsed - previous.heapUsed) / 1024 / 1024;
    const rssDiff = (memory.rss - previous.rss) / 1024 / 1024;
    
    if (heapUsedDiff > 10 || rssDiff > 10) {
      console.log(`   ⚠️  Growth: Heap +${heapUsedDiff.toFixed(2)} MB, RSS +${rssDiff.toFixed(2)} MB`);
    } else {
      console.log(`   ✅ Stable: Heap ${heapUsedDiff >= 0 ? "+" : ""}${heapUsedDiff.toFixed(2)} MB, RSS ${rssDiff >= 0 ? "+" : ""}${rssDiff.toFixed(2)} MB`);
    }
  }
  
  // Force GC every interval if available
  if (global.gc) {
    global.gc();
  }
  
  intervalCount++;
}

async function main() {
  console.log("🔍 Quick Memory Leak Test (2 minutes)");
  console.log("=".repeat(50));
  console.log(`Node.js: ${process.version}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
  console.log(`GC available: ${global.gc ? "Yes ✅" : "No ❌ (run with --expose-gc)"}`);
  console.log("=".repeat(50));
  
  // Initial snapshot
  console.log("\n📸 Initial Memory:");
  logMemoryStatus();
  
  // Monitor every 60 seconds
  const monitorInterval = setInterval(() => {
    logMemoryStatus();
    
    if (intervalCount >= MAX_INTERVALS) {
      console.log("\n✅ Test completed!");
      generateReport();
      clearInterval(monitorInterval);
      process.exit(0);
    }
  }, 60000);
  
  // Handle Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Test interrupted");
    generateReport();
    clearInterval(monitorInterval);
    process.exit(0);
  });
}

function generateReport() {
  if (memoryHistory.length < 2) {
    console.log("\n⚠️  Not enough data");
    return;
  }
  
  const first = memoryHistory[0].memory;
  const last = memoryHistory[memoryHistory.length - 1].memory;
  const duration = (last.time - first.time) / 1000 / 60;
  
  const heapGrowth = (last.heapUsed - first.heapUsed) / 1024 / 1024;
  const rssGrowth = (last.rss - first.rss) / 1024 / 1024;
  const avgHeapGrowth = heapGrowth / duration;
  const avgRssGrowth = rssGrowth / duration;
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 MEMORY LEAK TEST RESULTS");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`\nMemory Growth:`);
  console.log(`   Heap: ${formatMemory(first).heapUsed} → ${formatMemory(last).heapUsed} (${heapGrowth >= 0 ? "+" : ""}${heapGrowth.toFixed(2)} MB)`);
  console.log(`   RSS: ${formatMemory(first).rss} → ${formatMemory(last).rss} (${rssGrowth >= 0 ? "+" : ""}${rssGrowth.toFixed(2)} MB)`);
  console.log(`\nAverage Growth Rate:`);
  console.log(`   Heap: ${avgHeapGrowth >= 0 ? "+" : ""}${avgHeapGrowth.toFixed(2)} MB/min`);
  console.log(`   RSS: ${avgRssGrowth >= 0 ? "+" : ""}${avgRssGrowth.toFixed(2)} MB/min`);
  
  console.log(`\n🔍 Verdict:`);
  if (avgHeapGrowth > 10 || avgRssGrowth > 10) {
    console.log("   🔴 MEMORY LEAK DETECTED!");
    console.log("   ⚠️  Memory growing too fast - review code for leaks");
  } else if (avgHeapGrowth > 5 || avgRssGrowth > 5) {
    console.log("   🟡 POTENTIAL ISSUE");
    console.log("   💡 Monitor in production - growth is higher than expected");
  } else {
    console.log("   ✅ NO LEAK DETECTED");
    console.log("   🎉 Memory is stable!");
  }
  console.log("=".repeat(50));
}

main().catch(console.error);

