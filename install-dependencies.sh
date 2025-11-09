#!/bin/bash
# Install Production Dependencies Script
# Run this on your cPanel server after deployment

echo "=========================================="
echo "📦 Installing Production Dependencies"
echo "=========================================="
echo ""

# Navigate to backend directory
cd ~/public_html/myapp/backend 2>/dev/null || cd ~/public_html/myapp 2>/dev/null

if [ ! -f "package.json" ]; then
    echo "❌ ERROR: package.json not found!"
    echo "   Current directory: $(pwd)"
    echo "   Please navigate to the backend directory"
    exit 1
fi

echo "📋 Current directory: $(pwd)"
echo "📋 Node.js version: $(node --version)"
echo "📋 npm version: $(npm --version)"
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "⚠️  node_modules directory already exists"
    read -p "Do you want to remove it and reinstall? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🧹 Removing existing node_modules..."
        rm -rf node_modules
        echo "✅ Removed"
    else
        echo "ℹ️  Keeping existing node_modules"
        echo "   If you encounter issues, remove node_modules and run this script again"
        exit 0
    fi
fi

echo ""
echo "📦 Installing dependencies with legacy peer deps..."
echo "   This may take a few minutes..."
echo ""

# Install with legacy peer deps flag
npm install --production --legacy-peer-deps

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "📊 Installation Summary:"
    echo "   • Production dependencies installed"
    echo "   • Legacy peer deps flag used (avoids conflicts)"
    echo "   • Dev dependencies excluded"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Set environment variables in cPanel Node.js App"
    echo "   2. Set startup file to: start.sh"
    echo "   3. Restart Node.js app"
    echo "   4. Check logs for successful startup"
else
    echo ""
    echo "❌ Installation failed!"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   • Check disk space: df -h"
    echo "   • Check Node.js version: node --version (should be 18+)"
    echo "   • Check npm version: npm --version"
    echo "   • Try: npm cache clean --force"
    echo "   • Then run this script again"
    exit 1
fi

