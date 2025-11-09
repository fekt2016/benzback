#!/usr/bin/env node
/**
 * Server Wrapper - Forces memory settings before starting server
 * Use this as the startup file if start.sh doesn't work in cPanel
 * 
 * In cPanel Node.js App settings:
 * Set "Startup File" to: server-wrapper.js
 */

// CRITICAL: Set memory options BEFORE any other code runs
// This must happen before requiring any modules
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096 --expose-gc';

// Force memory limit by spawning a new process with the correct flags
// This is a workaround for cPanel that ignores NODE_OPTIONS
const { spawn } = require('child_process');
const path = require('path');

// Get the actual server.js path
const serverPath = path.join(__dirname, 'server.js');

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Log what we're doing
console.log('==========================================');
console.log('🚀 Server Wrapper Starting');
console.log('==========================================');
console.log('📋 Forcing memory settings...');
console.log('📋 NODE_OPTIONS:', process.env.NODE_OPTIONS);
console.log('📋 Node.js version:', process.version);
console.log('📋 NODE_ENV:', process.env.NODE_ENV);
console.log('==========================================');

// Parse NODE_OPTIONS to extract flags
const nodeOptions = process.env.NODE_OPTIONS.split(' ');
const nodeArgs = [];

// Extract --max-old-space-size
const maxMemoryMatch = process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/);
if (maxMemoryMatch) {
  nodeArgs.push(`--max-old-space-size=${maxMemoryMatch[1]}`);
}

// Extract --expose-gc
if (process.env.NODE_OPTIONS.includes('--expose-gc')) {
  nodeArgs.push('--expose-gc');
}

// Start server with memory flags
const serverProcess = spawn('node', [...nodeArgs, serverPath], {
  env: process.env,
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process events
serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  if (code !== null && code !== 0) {
    console.error(`❌ Server process exited with code ${code}`);
    process.exit(code);
  }
  if (signal) {
    console.error(`❌ Server process killed with signal ${signal}`);
    process.exit(1);
  }
});

// Forward signals
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});

