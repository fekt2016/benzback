#!/bin/bash
# cPanel Diagnostic Script
# Run this in your cPanel terminal to gather diagnostic information

echo "=========================================="
echo "🔍 cPanel Production Diagnostic Script"
echo "=========================================="
echo ""

# Navigate to backend directory
cd ~/public_html/myapp/backend 2>/dev/null || cd ~/public_html/myapp 2>/dev/null

echo "📋 Current Directory: $(pwd)"
echo ""

# 1. Check if backend directory exists
if [ ! -d "backend" ] && [ ! -f "server.js" ]; then
    echo "❌ ERROR: Cannot find backend directory or server.js"
    echo "   Current directory contents:"
    ls -la | head -20
    exit 1
fi

# Navigate to backend if needed
if [ -d "backend" ]; then
    cd backend
    echo "✅ Found backend directory, navigating..."
    echo "📋 Backend Directory: $(pwd)"
    echo ""
fi

echo "=========================================="
echo "1️⃣ FILE STRUCTURE CHECK"
echo "=========================================="
echo ""

echo "📁 Checking services directory:"
if [ -d "services" ]; then
    echo "   ✅ services/ exists"
    echo "   Files in services/:"
    ls -la services/ | grep -E "\.js$" | awk '{print "      " $9}'
else
    echo "   ❌ services/ directory NOT FOUND"
fi
echo ""

echo "📁 Checking middleware directory:"
if [ -d "middleware" ]; then
    echo "   ✅ middleware/ exists"
    echo "   Files in middleware/:"
    ls -la middleware/ | grep -E "bookingUpload|avatarUpload" | awk '{print "      " $9}'
else
    echo "   ❌ middleware/ directory NOT FOUND"
fi
echo ""

echo "📁 Checking critical files:"
CRITICAL_FILES=(
    "server.js"
    "app.js"
    "package.json"
    "start.sh"
    "services/stripeClient.js"
    "services/cloudinaryClient.js"
    "services/sendGridClient.js"
    "middleware/bookingUpload.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file MISSING"
    fi
done
echo ""

echo "=========================================="
echo "2️⃣ PACKAGE INSTALLATION CHECK"
echo "=========================================="
echo ""

if [ -f "package.json" ]; then
    echo "📦 Checking p-limit installation:"
    if npm list p-limit 2>/dev/null | grep -q "p-limit"; then
        npm list p-limit 2>/dev/null | head -3
        echo "   ✅ p-limit is installed"
    else
        echo "   ❌ p-limit NOT INSTALLED"
        echo "   Run: npm install p-limit"
    fi
    echo ""
    
    echo "📦 Checking other critical packages:"
    for pkg in "stripe" "cloudinary" "@sendgrid/mail"; do
        if npm list "$pkg" 2>/dev/null | grep -q "$pkg"; then
            echo "   ✅ $pkg installed"
        else
            echo "   ❌ $pkg NOT INSTALLED"
        fi
    done
else
    echo "❌ package.json NOT FOUND"
fi
echo ""

echo "=========================================="
echo "3️⃣ ENVIRONMENT VARIABLES CHECK"
echo "=========================================="
echo ""

# Check if config.env exists
if [ -f "config.env" ]; then
    echo "✅ config.env exists"
    echo "   Checking for required variables (showing only if set, not values):"
    
    ENV_VARS=(
        "STRIPE_SECRET_KEY"
        "CLOUDINARY_CLOUD_NAME"
        "CLOUDINARY_API_KEY"
        "CLOUDINARY_API_SECRET"
        "SENDGRID_API_KEY"
        "NODE_OPTIONS"
        "DEBUG_KEY"
    )
    
    for var in "${ENV_VARS[@]}"; do
        if grep -q "^${var}=" config.env 2>/dev/null; then
            echo "   ✅ $var is set"
        else
            echo "   ❌ $var NOT SET"
        fi
    done
else
    echo "❌ config.env NOT FOUND"
fi
echo ""

# Check NODE_OPTIONS from environment
if [ -n "$NODE_OPTIONS" ]; then
    echo "✅ NODE_OPTIONS environment variable: $NODE_OPTIONS"
else
    echo "❌ NODE_OPTIONS environment variable NOT SET"
fi
echo ""

echo "=========================================="
echo "4️⃣ NODE.JS VERSION & MEMORY"
echo "=========================================="
echo ""

if command -v node &> /dev/null; then
    echo "📋 Node.js version: $(node --version)"
    
    # Check memory limit
    echo ""
    echo "📋 Checking memory configuration:"
    node -e "const v8 = require('v8'); const heapLimit = v8.getHeapStatistics().heap_size_limit / 1024 / 1024; console.log('   Current max memory: ' + heapLimit.toFixed(2) + 'MB');"
else
    echo "❌ Node.js not found in PATH"
fi
echo ""

echo "=========================================="
echo "5️⃣ RECENT LOGS (Last 50 lines)"
echo "=========================================="
echo ""

# Try to find log files
LOG_PATHS=(
    "$HOME/logs/nodejs.log"
    "$HOME/logs/app.log"
    "logs/app.log"
    "logs/error.log"
    "/var/log/nodejs.log"
)

LOG_FOUND=false
for log_path in "${LOG_PATHS[@]}"; do
    if [ -f "$log_path" ]; then
        echo "📄 Found log: $log_path"
        echo "   Last 50 lines:"
        echo "   ----------------------------------------"
        tail -n 50 "$log_path" | sed 's/^/   /'
        echo "   ----------------------------------------"
        LOG_FOUND=true
        break
    fi
done

if [ "$LOG_FOUND" = false ]; then
    echo "⚠️  No log files found in common locations"
    echo "   Please check cPanel → Node.js App → Logs"
fi
echo ""

echo "=========================================="
echo "6️⃣ QUICK MODULE TEST"
echo "=========================================="
echo ""

echo "🧪 Testing module imports:"
echo ""

# Test p-limit
echo "   Testing p-limit..."
node -e "
try {
  const pLimitModule = require('p-limit');
  const pLimit = pLimitModule.default || pLimitModule;
  const limit = pLimit(3);
  if (typeof limit === 'function') {
    console.log('   ✅ p-limit imports correctly');
  } else {
    console.log('   ❌ p-limit is not a function');
  }
} catch(e) {
  console.log('   ❌ p-limit error:', e.message);
}
" 2>&1

# Test singleton services
echo ""
echo "   Testing singleton services..."
node -e "
try {
  const stripe = require('./services/stripeClient.js');
  console.log('   ✅ Stripe client: OK');
} catch(e) {
  console.log('   ❌ Stripe client error:', e.message);
}

try {
  const cloudinary = require('./services/cloudinaryClient.js');
  console.log('   ✅ Cloudinary client: OK');
} catch(e) {
  console.log('   ❌ Cloudinary client error:', e.message);
}

try {
  const sendGrid = require('./services/sendGridClient.js');
  console.log('   ✅ SendGrid client: OK');
} catch(e) {
  console.log('   ❌ SendGrid client error:', e.message);
}
" 2>&1

echo ""
echo "=========================================="
echo "7️⃣ STARTUP FILE CHECK"
echo "=========================================="
echo ""

if [ -f "start.sh" ]; then
    echo "✅ start.sh exists"
    echo "   Checking contents:"
    echo "   ----------------------------------------"
    head -n 20 start.sh | sed 's/^/   /'
    echo "   ----------------------------------------"
    echo ""
    echo "   File permissions:"
    ls -la start.sh | awk '{print "   " $0}'
else
    echo "❌ start.sh NOT FOUND"
fi
echo ""

echo "=========================================="
echo "✅ DIAGNOSTIC COMPLETE"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "   1. Copy ALL output above"
echo "   2. Check cPanel → Node.js App → Logs for startup errors"
echo "   3. Share both the diagnostic output AND the startup logs"
echo ""
echo "💡 This information will help identify the issue!"

