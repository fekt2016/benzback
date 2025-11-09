#!/bin/bash
# Production Memory Monitor Script
# Runs server and monitors memory for 5 minutes

echo "🔍 Production Memory Monitoring"
echo "================================"
echo ""

# Set production environment
export NODE_ENV=production

# Start server in background and capture output
echo "🚀 Starting production server..."
npm run start:prod > server-output.log 2>&1 &
SERVER_PID=$!

echo "📋 Server PID: $SERVER_PID"
echo "⏱️  Monitoring for 5 minutes..."
echo ""

# Wait a bit for server to start
sleep 10

# Monitor memory every 30 seconds
for i in {1..10}; do
    sleep 30
    
    # Get memory usage of the server process
    if ps -p $SERVER_PID > /dev/null; then
        MEMORY=$(ps -o rss= -p $SERVER_PID)
        MEMORY_MB=$((MEMORY / 1024))
        echo "[$i/10] Memory: ${MEMORY_MB}MB"
    else
        echo "[$i/10] Server process not found (may have crashed)"
        break
    fi
done

echo ""
echo "📊 Analysis complete. Checking server logs..."
echo ""

# Check for memory errors in logs
if grep -q "Out of memory\|WebAssembly\|RangeError" server-output.log; then
    echo "❌ MEMORY ERROR DETECTED IN LOGS!"
    echo ""
    grep -A 5 -B 5 "Out of memory\|WebAssembly\|RangeError" server-output.log
    echo ""
fi

# Show last 20 lines of server output
echo "📋 Last 20 lines of server output:"
echo "-----------------------------------"
tail -20 server-output.log

# Kill server
echo ""
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "✅ Monitoring complete"

