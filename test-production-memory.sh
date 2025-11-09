#!/bin/bash
# Production Memory Test Script
# This script runs the server in production mode and monitors memory

echo "🚀 Starting Production Memory Test"
echo "=================================="
echo ""

# Set environment
export NODE_ENV=production

# Start server in background
echo "📡 Starting production server..."
NODE_ENV=production node --max-old-space-size=8192 --expose-gc server.js > server.log 2>&1 &
SERVER_PID=$!

echo "✅ Server started (PID: $SERVER_PID)"
echo "📋 Monitoring memory for 5 minutes..."
echo ""

# Wait a bit for server to start
sleep 10

# Monitor memory every 30 seconds for 5 minutes
for i in {1..10}; do
  sleep 30
  if ps -p $SERVER_PID > /dev/null; then
    MEM=$(ps -o rss= -p $SERVER_PID)
    MEM_MB=$((MEM / 1024))
    echo "[$i/10] Memory: ${MEM_MB}MB"
  else
    echo "❌ Server crashed! Check server.log"
    break
  fi
done

echo ""
echo "📊 Final Memory Check:"
if ps -p $SERVER_PID > /dev/null; then
  MEM=$(ps -o rss= -p $SERVER_PID)
  MEM_MB=$((MEM / 1024))
  echo "✅ Server still running"
  echo "📋 Final Memory: ${MEM_MB}MB"
  echo ""
  echo "🛑 Stopping server..."
  kill $SERVER_PID
  wait $SERVER_PID 2>/dev/null
else
  echo "❌ Server is not running"
  echo "📋 Check server.log for errors:"
  tail -20 server.log
fi

echo ""
echo "✅ Test complete"

