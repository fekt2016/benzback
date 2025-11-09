#!/bin/bash
# Analyze memory from production logs

LOG_FILE="production-run.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    exit 1
fi

echo "📊 Memory Analysis from Production Run"
echo "======================================="
echo ""

# Extract all memory logs
echo "📈 Memory Usage Over Time:"
echo "--------------------------"
grep "💾 Memory:" "$LOG_FILE" | tail -20

echo ""
echo "📊 Memory Statistics:"
echo "---------------------"

# Get all heap values
HEAP_VALUES=$(grep "💾 Memory:" "$LOG_FILE" | grep -oP "Heap \K[\d.]+" | head -20)

if [ -z "$HEAP_VALUES" ]; then
    echo "⚠️  No memory logs found. Server may not be in production mode."
    echo "   Make sure NODE_ENV=production is set."
    exit 1
fi

# Calculate min, max, average
MIN=$(echo "$HEAP_VALUES" | sort -n | head -1)
MAX=$(echo "$HEAP_VALUES" | sort -n | tail -1)
FIRST=$(echo "$HEAP_VALUES" | head -1)
LAST=$(echo "$HEAP_VALUES" | tail -1)
GROWTH=$(echo "$LAST - $FIRST" | bc)

echo "   Initial Heap: ${FIRST}MB"
echo "   Final Heap: ${LAST}MB"
echo "   Growth: ${GROWTH}MB"
echo "   Min: ${MIN}MB"
echo "   Max: ${MAX}MB"

# Check for leaks
echo ""
echo "🔍 Leak Detection:"
echo "------------------"

if (( $(echo "$GROWTH > 50" | bc -l) )); then
    echo "   🔴 POTENTIAL MEMORY LEAK!"
    echo "   ⚠️  Memory grew by ${GROWTH}MB"
    echo "   🔧 Review code for memory leaks"
elif (( $(echo "$GROWTH > 20" | bc -l) )); then
    echo "   🟡 MINOR GROWTH"
    echo "   💡 Memory grew by ${GROWTH}MB (monitor in production)"
else
    echo "   ✅ NO LEAK DETECTED"
    echo "   🎉 Memory is stable (growth: ${GROWTH}MB)"
fi

# Check for errors
echo ""
echo "❌ Errors Check:"
echo "----------------"
if grep -q "Out of memory\|WebAssembly\|RangeError\|ERROR" "$LOG_FILE"; then
    echo "   🔴 ERRORS FOUND!"
    grep -i "error\|out of memory\|webassembly\|rangeerror" "$LOG_FILE" | tail -5
else
    echo "   ✅ No memory errors detected"
fi

echo ""
echo "✅ Analysis complete"

