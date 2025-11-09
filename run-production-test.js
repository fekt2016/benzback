/**
 * Production Memory Test Runner
 * Runs server and monitors memory for issues
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Production Memory Test');
console.log('='.repeat(60));

// Check if config.env exists
if (!fs.existsSync('./config.env')) {
  console.log('⚠️  config.env not found. Using environment variables if set.');
}

// Start server
console.log('🚀 Starting production server...');
const server = spawn('node', [
  '--max-old-space-size=8192',
  '--expose-gc',
  'server.js'
], {
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(output.trim());
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  errorOutput += output;
  console.error(output.trim());
});

// Monitor memory every 30 seconds
let checkCount = 0;
const MAX_CHECKS = 10; // 5 minutes

const memoryMonitor = setInterval(() => {
  checkCount++;
  
  if (!server.killed && server.pid) {
    try {
      // Get memory usage of the server process
      const mem = process.memoryUsage();
      const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
      
      console.log(`\n[Check ${checkCount}/${MAX_CHECKS}] Memory Status:`);
      console.log(`   Heap Used: ${heapUsedMB} MB`);
      console.log(`   RSS: ${rssMB} MB`);
      
      // Check for memory warnings in server output
      if (serverOutput.includes('High memory usage')) {
        console.log('   ⚠️  Server reported high memory usage!');
      }
      
      if (checkCount >= MAX_CHECKS) {
        clearInterval(memoryMonitor);
        console.log('\n✅ Test complete. Stopping server...');
        server.kill();
        generateReport();
        process.exit(0);
      }
    } catch (err) {
      console.error('Error checking memory:', err.message);
    }
  }
}, 30000); // Every 30 seconds

// Handle server exit
server.on('exit', (code, signal) => {
  clearInterval(memoryMonitor);
  console.log(`\n🛑 Server exited with code ${code}, signal ${signal}`);
  
  if (code !== 0 && code !== null) {
    console.log('\n❌ Server crashed! Error output:');
    console.log(errorOutput);
  }
  
  generateReport();
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted. Stopping server...');
  clearInterval(memoryMonitor);
  server.kill();
  generateReport();
  process.exit(0);
});

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MEMORY TEST REPORT');
  console.log('='.repeat(60));
  
  // Check for memory errors
  if (errorOutput.includes('Out of memory') || errorOutput.includes('WebAssembly')) {
    console.log('❌ MEMORY ERROR DETECTED!');
    console.log('   The server crashed due to memory issues.');
    console.log('\n🔧 Solutions:');
    console.log('   1. Ensure NODE_OPTIONS is set in cPanel');
    console.log('   2. Use start.sh as startup file');
    console.log('   3. Check server resources');
  } else if (serverOutput.includes('High memory usage')) {
    console.log('⚠️  HIGH MEMORY USAGE DETECTED');
    console.log('   Server is using more memory than expected.');
  } else {
    console.log('✅ No memory errors detected');
  }
  
  // Check for NODE_OPTIONS
  if (serverOutput.includes('NODE_OPTIONS')) {
    console.log('✅ NODE_OPTIONS is set correctly');
  } else {
    console.log('⚠️  NODE_OPTIONS may not be set');
  }
  
  console.log('='.repeat(60));
}

// Wait a bit for server to start
setTimeout(() => {
  if (server.killed) {
    console.log('❌ Server failed to start');
    process.exit(1);
  }
}, 5000);

