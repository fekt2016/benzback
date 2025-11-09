#!/bin/bash
# cPanel Startup Script - Ensures Node.js memory flags are applied
# This script MUST be used as the startup file in cPanel Node.js App settings
# 
# IMPORTANT: In cPanel Node.js App settings:
# 1. Set "Startup File" to: start.sh
# 2. Add environment variable: NODE_OPTIONS=--max-old-space-size=2048 --expose-gc

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set Node.js memory options (3GB - CloudLinux LVE limit is 4GB, need headroom for WebAssembly)
# CloudLinux LVE "Max resident set" is 4GB, so we use 3GB to leave room for WebAssembly/undici
export NODE_OPTIONS="--max-old-space-size=3072 --expose-gc"

# Set production environment
export NODE_ENV=production

# Log the settings (will appear in cPanel logs)
echo "=========================================="
echo "🚀 Starting server with memory settings"
echo "=========================================="
echo "📋 Script directory: $SCRIPT_DIR"
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
echo "📋 NODE_ENV: $NODE_ENV"
echo "📋 Current directory: $(pwd)"
echo "=========================================="

# Verify server.js exists
if [ ! -f "$SCRIPT_DIR/server.js" ]; then
  echo "❌ ERROR: server.js not found in $SCRIPT_DIR"
  echo "❌ Files in directory:"
  ls -la "$SCRIPT_DIR" | head -20
  exit 1
fi

# CRITICAL: Use exec with explicit node flags and full path
# Try multiple methods to ensure memory flags are applied
if command -v node &> /dev/null; then
  # Method 1: Use node from PATH with explicit flags
  # Use 3GB to stay under CloudLinux LVE 4GB limit (leaves room for WebAssembly)
  exec node --max-old-space-size=3072 --expose-gc "$SCRIPT_DIR/server.js"
else
  # Method 2: Try common node locations
  if [ -f "/usr/bin/node" ]; then
    exec /usr/bin/node --max-old-space-size=3072 --expose-gc "$SCRIPT_DIR/server.js"
  elif [ -f "/usr/local/bin/node" ]; then
    exec /usr/local/bin/node --max-old-space-size=3072 --expose-gc "$SCRIPT_DIR/server.js"
  else
    echo "❌ ERROR: Node.js not found"
    exit 1
  fi
fi

