#!/bin/bash
# Alternative startup script - More aggressive memory forcing
# Use this if start.sh doesn't work

# Force memory settings - multiple methods
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"
export NODE_ENV=production

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "🚀 Starting server (Alternative Method)"
echo "=========================================="
echo "📋 Script directory: $SCRIPT_DIR"
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
echo "📋 NODE_ENV: $NODE_ENV"
echo "=========================================="

# Try with explicit path to node and flags
# Use 2GB instead of 4GB in case server has limited RAM
/usr/bin/node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js" 2>&1

# If that fails, try with just node
if [ $? -ne 0 ]; then
  echo "⚠️  First attempt failed, trying alternative..."
  node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js" 2>&1
fi

