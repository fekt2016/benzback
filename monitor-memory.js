/**
 * Production Memory Monitor
 * Monitors memory usage and detects leaks in real-time
 * Run: NODE_ENV=production node --max-old-space-size=8192 --expose-gc monitor-memory.js
 */

const { spawn } = require('child_process');
const path = require('path');

const memoryHistory = [];
let startTime = Date.now();
let checkCount = 0;
const MAX_CHECKS = 60; // Monitor for 60 checks (60 minutes if 1 min intervals)

function formatMemory(mb) {
  return mb.toFixed(2) + ' MB';
}

function analyzeMemory() {
  const mem = process.memoryUsage();
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  const heapTotalMB = mem.heapTotal / 1024 / 1024;
  const rssMB = mem.rss / 1024 / 1024;
  
  const entry = {
    time: Date.now(),
    heapUsed: heapUsedMB,
    heapTotal: heapTotalMB,
    rss: rssMB,
    external: mem.external / 1024 / 1024,
  };
  
  memoryHistory.push(entry);
  checkCount++;
  
  // Calculate growth
  let growth = '';
  let leakWarning = '';
  
  if (memoryHistory.length > 1) {
    const prev = memoryHistory[memoryHistory.length - 2];
    const heapGrowth = heapUsedMB - prev.heapUsed;
    const rssGrowth = rssMB - prev.rss;
    
    growth = ` (Heap: ${heapGrowth >= 0 ? '+' : ''}${heapGrowth.toFixed(2)}MB, RSS: ${rssGrowth >= 0 ? '+' : ''}${rssGrowth.toFixed(2)}MB)`;
    
    // Detect potential leak
    if (heapGrowth > 10 || rssGrowth > 10) {
      leakWarning = ' ⚠️  POTENTIAL LEAK!';
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  console.log(`[${checkCount}/${MAX_CHECKS}] [${elapsed}min] Heap: ${formatMemory(heapUsedMB)} / ${formatMemory(heapTotalMB)} | RSS: ${formatMemory(rssMB)}${growth}${leakWarning}`);
  
  // Generate summary every 10 checks
  if (checkCount % 10 === 0 && memoryHistory.length >= 10) {
    generateSummary();
  }
  
  // Force GC if available
  if (global.gc && checkCount % 5 === 0) {
    const beforeGC = process.memoryUsage().heapUsed / 1024 / 1024;
    global.gc();
    const afterGC = process.memoryUsage().heapUsed / 1024 / 1024;
    const freed = beforeGC - afterGC;
    console.log(`   🧹 GC ran: Freed ${freed.toFixed(2)}MB (${beforeGC.toFixed(2)}MB → ${afterGC.toFixed(2)}MB)`);
  }
}

function generateSummary() {
  if (memoryHistory.length < 2) return;
  
  const first = memoryHistory[0];
  const last = memoryHistory[memoryHistory.length - 1];
  const duration = (last.time - first.time) / 1000 / 60;
  
  const heapGrowth = last.heapUsed - first.heapUsed;
  const rssGrowth = last.rss - first.rss;
  const avgHeapGrowth = heapGrowth / duration;
  const avgRssGrowth = rssGrowth / duration;
  
  console.log(`\n📊 Summary (${memoryHistory.length} checks, ${duration.toFixed(2)} min):`);
  console.log(`   Heap: ${formatMemory(first.heapUsed)} → ${formatMemory(last.heapUsed)} (${heapGrowth >= 0 ? '+' : ''}${heapGrowth.toFixed(2)}MB)`);
  console.log(`   RSS: ${formatMemory(first.rss)} → ${formatMemory(last.rss)} (${rssGrowth >= 0 ? '+' : ''}${rssGrowth.toFixed(2)}MB)`);
  console.log(`   Avg Growth: Heap ${avgHeapGrowth >= 0 ? '+' : ''}${avgHeapGrowth.toFixed(2)}MB/min, RSS ${avgRssGrowth >= 0 ? '+' : ''}${avgRssGrowth.toFixed(2)}MB/min`);
  
  if (avgHeapGrowth > 10 || avgRssGrowth > 10) {
    console.log(`   🔴 MEMORY LEAK DETECTED! Growth rate too high.`);
  } else if (avgHeapGrowth > 5 || avgRssGrowth > 5) {
    console.log(`   🟡 POTENTIAL ISSUE: Monitor closely.`);
  } else {
    console.log(`   ✅ Memory stable.`);
  }
  console.log('');
}

function finalReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL MEMORY ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  if (memoryHistory.length < 2) {
    console.log('⚠️  Not enough data collected');
    return;
  }
  
  const first = memoryHistory[0];
  const last = memoryHistory[memoryHistory.length - 1];
  const duration = (last.time - first.time) / 1000 / 60;
  
  const heapGrowth = last.heapUsed - first.heapUsed;
  const rssGrowth = last.rss - first.rss;
  const avgHeapGrowth = heapGrowth / duration;
  const avgRssGrowth = rssGrowth / duration;
  
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Data Points: ${memoryHistory.length}`);
  console.log(`\nMemory Growth:`);
  console.log(`   Heap Used: ${formatMemory(first.heapUsed)} → ${formatMemory(last.heapUsed)} (${heapGrowth >= 0 ? '+' : ''}${heapGrowth.toFixed(2)}MB)`);
  console.log(`   RSS: ${formatMemory(first.rss)} → ${formatMemory(last.rss)} (${rssGrowth >= 0 ? '+' : ''}${rssGrowth.toFixed(2)}MB)`);
  console.log(`\nAverage Growth Rate:`);
  console.log(`   Heap: ${avgHeapGrowth >= 0 ? '+' : ''}${avgHeapGrowth.toFixed(2)}MB/min`);
  console.log(`   RSS: ${avgRssGrowth >= 0 ? '+' : ''}${avgRssGrowth.toFixed(2)}MB/min`);
  
  console.log(`\n🔍 Verdict:`);
  if (avgHeapGrowth > 10 || avgRssGrowth > 10) {
    console.log(`   🔴 MEMORY LEAK DETECTED!`);
    console.log(`   ⚠️  Memory is growing at ${avgHeapGrowth.toFixed(2)}MB/min`);
    console.log(`   🔧 Action Required: Review code for memory leaks`);
  } else if (avgHeapGrowth > 5 || avgRssGrowth > 5) {
    console.log(`   🟡 POTENTIAL MEMORY ISSUE`);
    console.log(`   💡 Monitor in production for 24+ hours`);
  } else {
    console.log(`   ✅ NO MEMORY LEAK DETECTED`);
    console.log(`   🎉 Memory usage is stable!`);
  }
  
  // Find peak memory
  const peakHeap = Math.max(...memoryHistory.map(m => m.heapUsed));
  const peakRss = Math.max(...memoryHistory.map(m => m.rss));
  console.log(`\nPeak Memory:`);
  console.log(`   Heap: ${formatMemory(peakHeap)}`);
  console.log(`   RSS: ${formatMemory(peakRss)}`);
  
  console.log('='.repeat(60));
}

// Start monitoring
console.log('🔍 Starting Production Memory Monitor');
console.log('='.repeat(60));
console.log(`Node.js: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`GC Available: ${global.gc ? 'Yes ✅' : 'No ❌ (run with --expose-gc)'}`);
console.log(`Max Memory: ${(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(2)}MB`);
console.log('='.repeat(60));
console.log('Monitoring every 60 seconds. Press Ctrl+C to stop.\n');

// Initial snapshot
analyzeMemory();

// Monitor every 60 seconds
const monitorInterval = setInterval(() => {
  analyzeMemory();
  
  if (checkCount >= MAX_CHECKS) {
    clearInterval(monitorInterval);
    finalReport();
    process.exit(0);
  }
}, 60000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Monitoring stopped by user');
  clearInterval(monitorInterval);
  finalReport();
  process.exit(0);
});

