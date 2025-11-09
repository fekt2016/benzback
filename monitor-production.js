/**
 * Production Memory Monitor
 * Runs the server and monitors memory usage to detect leaks
 */

const { spawn } = require('child_process');
const fs = require('fs');

const memoryLog = [];
const MAX_RUNTIME = 10 * 60 * 1000; // 10 minutes
const CHECK_INTERVAL = 30000; // Check every 30 seconds
const startTime = Date.now();

console.log("🔍 Starting Production Memory Monitor");
console.log("=".repeat(60));
console.log(`Runtime: ${MAX_RUNTIME / 1000 / 60} minutes`);
console.log(`Check interval: ${CHECK_INTERVAL / 1000} seconds`);
console.log("=".repeat(60));

// Start production server
console.log("\n🚀 Starting production server...\n");

const server = spawn('npm', ['run', 'start:prod'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
let serverErrors = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  process.stdout.write(output);
  
  // Check for memory logs
  if (output.includes('💾 Memory:') || output.includes('Memory:')) {
    const memoryMatch = output.match(/Heap\s+([\d.]+)MB/);
    if (memoryMatch) {
      const heapUsed = parseFloat(memoryMatch[1]);
      memoryLog.push({
        time: Date.now(),
        heapUsed,
        output: output.trim()
      });
    }
  }
  
  // Check for errors
  if (output.includes('❌') || output.includes('ERROR') || output.includes('Error')) {
    console.error('\n⚠️  Error detected in server output');
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  serverErrors += error;
  process.stderr.write(error);
  
  // Check for memory errors
  if (error.includes('Out of memory') || error.includes('WebAssembly') || error.includes('RangeError')) {
    console.error('\n🔴 CRITICAL MEMORY ERROR DETECTED!');
    console.error(error);
    analyzeMemoryIssue();
  }
});

server.on('close', (code) => {
  console.log(`\n\n📊 Server exited with code ${code}`);
  generateReport();
  process.exit(code);
});

// Monitor memory from outside
const monitorInterval = setInterval(() => {
  try {
    // Try to get memory info from process
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    
    memoryLog.push({
      time: Date.now(),
      heapUsed: parseFloat(heapUsedMB),
      source: 'monitor',
      rss: (memUsage.rss / 1024 / 1024).toFixed(2)
    });
    
    console.log(`\n📊 [Monitor] Heap: ${heapUsedMB}MB, RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
    
    // Check for memory growth
    if (memoryLog.length > 2) {
      const recent = memoryLog.slice(-5);
      const growth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
      
      if (growth > 50) {
        console.warn(`⚠️  Memory growth detected: +${growth.toFixed(2)}MB in last 5 checks`);
      }
    }
  } catch (err) {
    console.error('Monitor error:', err.message);
  }
}, CHECK_INTERVAL);

// Stop after max runtime
setTimeout(() => {
  console.log('\n\n⏱️  Maximum runtime reached. Stopping monitor...');
  clearInterval(monitorInterval);
  server.kill('SIGTERM');
  
  setTimeout(() => {
    if (!server.killed) {
      server.kill('SIGKILL');
    }
    generateReport();
    process.exit(0);
  }, 5000);
}, MAX_RUNTIME);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping monitor...');
  clearInterval(monitorInterval);
  server.kill('SIGTERM');
  
  setTimeout(() => {
    if (!server.killed) {
      server.kill('SIGKILL');
    }
    generateReport();
    process.exit(0);
  }, 5000);
});

function analyzeMemoryIssue() {
  console.log('\n🔍 Analyzing memory issue...');
  
  if (memoryLog.length > 0) {
    const first = memoryLog[0];
    const last = memoryLog[memoryLog.length - 1];
    const growth = last.heapUsed - first.heapUsed;
    const duration = (last.time - first.time) / 1000 / 60; // minutes
    
    console.log(`\n📊 Memory Analysis:`);
    console.log(`   Initial: ${first.heapUsed.toFixed(2)}MB`);
    console.log(`   Final: ${last.heapUsed.toFixed(2)}MB`);
    console.log(`   Growth: +${growth.toFixed(2)}MB`);
    console.log(`   Duration: ${duration.toFixed(2)} minutes`);
    console.log(`   Rate: ${(growth / duration).toFixed(2)}MB/min`);
  }
}

function generateReport() {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 PRODUCTION MEMORY MONITORING REPORT');
  console.log('='.repeat(60));
  
  if (memoryLog.length === 0) {
    console.log('\n⚠️  No memory data collected');
    return;
  }
  
  const serverLogs = memoryLog.filter(m => m.source !== 'monitor');
  const monitorLogs = memoryLog.filter(m => m.source === 'monitor');
  
  console.log(`\n📈 Data Points Collected: ${memoryLog.length}`);
  console.log(`   Server logs: ${serverLogs.length}`);
  console.log(`   Monitor logs: ${monitorLogs.length}`);
  
  if (memoryLog.length >= 2) {
    const first = memoryLog[0];
    const last = memoryLog[memoryLog.length - 1];
    const duration = (last.time - first.time) / 1000 / 60; // minutes
    const heapGrowth = last.heapUsed - first.heapUsed;
    const avgGrowthPerMin = heapGrowth / duration;
    
    console.log(`\n📊 Memory Growth Analysis:`);
    console.log(`   Duration: ${duration.toFixed(2)} minutes`);
    console.log(`   Initial Heap: ${first.heapUsed.toFixed(2)}MB`);
    console.log(`   Final Heap: ${last.heapUsed.toFixed(2)}MB`);
    console.log(`   Total Growth: ${heapGrowth >= 0 ? '+' : ''}${heapGrowth.toFixed(2)}MB`);
    console.log(`   Average Growth: ${avgGrowthPerMin >= 0 ? '+' : ''}${avgGrowthPerMin.toFixed(2)}MB/min`);
    
    // Find peak memory
    const peak = memoryLog.reduce((max, curr) => 
      curr.heapUsed > max.heapUsed ? curr : max
    );
    console.log(`   Peak Memory: ${peak.heapUsed.toFixed(2)}MB`);
    
    // Determine if there's a leak
    console.log(`\n🔍 Leak Detection:`);
    if (avgGrowthPerMin > 10) {
      console.log(`   🔴 MEMORY LEAK DETECTED!`);
      console.log(`   ⚠️  Memory growing at ${avgGrowthPerMin.toFixed(2)}MB/min`);
      console.log(`   🔧 Action Required: Review code for memory leaks`);
    } else if (avgGrowthPerMin > 5) {
      console.log(`   🟡 POTENTIAL ISSUE`);
      console.log(`   ⚠️  Memory growth is higher than expected`);
      console.log(`   💡 Monitor in production for 24+ hours`);
    } else {
      console.log(`   ✅ NO LEAK DETECTED`);
      console.log(`   🎉 Memory growth is within acceptable limits`);
    }
  }
  
  // Check for errors
  if (serverErrors) {
    console.log(`\n❌ Errors Detected:`);
    console.log(serverErrors);
  }
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    duration: (Date.now() - startTime) / 1000 / 60,
    memoryLog,
    errors: serverErrors,
    summary: {
      initialHeap: memoryLog[0]?.heapUsed,
      finalHeap: memoryLog[memoryLog.length - 1]?.heapUsed,
      growth: memoryLog.length > 1 ? memoryLog[memoryLog.length - 1].heapUsed - memoryLog[0].heapUsed : 0
    }
  };
  
  fs.writeFileSync('memory-monitor-report.json', JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: memory-monitor-report.json`);
  
  console.log('\n' + '='.repeat(60));
}

