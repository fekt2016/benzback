#!/bin/bash
# Cleanup Production Files Script
# Removes all files not needed in production

echo "=========================================="
echo "🧹 Cleaning Up Non-Production Files"
echo "=========================================="
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📋 Current directory: $(pwd)"
echo ""

# Ask for confirmation
read -p "⚠️  This will delete files not needed in production. Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""
echo "🗑️  Starting cleanup..."
echo ""

# Count files to be deleted
DELETED_COUNT=0
DELETED_SIZE=0

# Function to delete file and track stats
delete_file() {
    if [ -f "$1" ] || [ -d "$1" ]; then
        SIZE=$(du -sb "$1" 2>/dev/null | cut -f1)
        rm -rf "$1"
        if [ $? -eq 0 ]; then
            DELETED_COUNT=$((DELETED_COUNT + 1))
            DELETED_SIZE=$((DELETED_SIZE + SIZE))
            echo "  ✅ Deleted: $1"
        else
            echo "  ❌ Failed to delete: $1"
        fi
    fi
}

# 1. Delete documentation files (*.md)
echo "📄 Removing documentation files..."
for file in *.md; do
    if [ -f "$file" ]; then
        delete_file "$file"
    fi
done
echo ""

# 2. Delete development/testing scripts
echo "🧪 Removing development/testing scripts..."
delete_file "analyze-memory.sh"
delete_file "check-production-ready.js"
delete_file "cpanel-diagnose.sh"
delete_file "create-production-archive.sh"
delete_file "install-dependencies.sh"
delete_file "monitor-memory.js"
delete_file "monitor-production.js"
delete_file "quick-memory-test.js"
delete_file "run-and-monitor.sh"
delete_file "run-production-test.js"
delete_file "test-memory-leak.js"
delete_file "test-production-memory.sh"
delete_file "start-node.sh"
delete_file "server-wrapper.js"
echo ""

# 3. Delete archive/backup files and directories
echo "📦 Removing archive/backup files..."
delete_file "production-archive"
delete_file "production-package.zip"
delete_file "memory-monitor-report.json"
delete_file "production-run.log"
echo ""

# 4. Delete scripts folder (development/admin scripts)
echo "📁 Removing scripts folder (development/admin scripts)..."
if [ -d "scripts" ]; then
    echo "  ⚠️  WARNING: scripts/ folder contains:"
    ls -1 scripts/ 2>/dev/null | sed 's/^/     - /'
    read -p "  Delete scripts folder? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        delete_file "scripts"
    else
        echo "  ℹ️  Keeping scripts folder"
    fi
fi
echo ""

# 5. Delete any remaining test files
echo "🔍 Removing any remaining test files..."
find . -maxdepth 1 -type f \( -name "*.test.js" -o -name "*.spec.js" -o -name "test-*.js" \) -not -path "./node_modules/*" -exec rm -f {} \;
echo ""

# Summary
echo "=========================================="
echo "✅ Cleanup Complete!"
echo "=========================================="
echo ""
DELETED_SIZE_MB=$(echo "scale=2; $DELETED_SIZE / 1024 / 1024" | bc)
echo "📊 Summary:"
echo "   Files/Directories deleted: $DELETED_COUNT"
echo "   Space freed: ~${DELETED_SIZE_MB}MB"
echo ""
echo "📋 Files kept for production:"
echo "   ✅ start.sh (cPanel startup script)"
echo "   ✅ server.js, app.js (main application files)"
echo "   ✅ package.json, package-lock.json (dependencies)"
echo "   ✅ All source code (controllers, models, routes, etc.)"
echo "   ✅ All services, utils, middleware, socket"
echo ""
echo "💡 Note: config.env is kept locally but should NOT be deployed"
echo "   (use cPanel environment variables instead)"
echo ""

