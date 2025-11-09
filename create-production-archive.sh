#!/bin/bash
# Production Archive Creator
# Creates a clean, production-ready archive for manual cPanel deployment

echo "=========================================="
echo "📦 Creating Production Archive"
echo "=========================================="
echo ""

# Get the backend directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Archive name with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="production-backend-${TIMESTAMP}"
ARCHIVE_DIR="production-archive"
FINAL_ARCHIVE="${ARCHIVE_NAME}.tar.gz"

# Clean up old archives
echo "🧹 Cleaning up old archives..."
rm -rf "$ARCHIVE_DIR"
rm -f production-backend-*.tar.gz
rm -f production-backend-*.zip
echo ""

# Create archive directory
echo "📁 Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"
echo ""

# Copy files with exclusions
echo "📋 Copying production files..."
echo "   Excluding: node_modules, .git, logs, tests, .md files, etc."
echo ""

rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='test' \
  --exclude='tests' \
  --exclude='*.test.js' \
  --exclude='*.spec.js' \
  --exclude='logs' \
  --exclude='*.log' \
  --exclude='*.md' \
  --exclude='**/*.md' \
  --exclude='config.env' \
  --exclude='*.env' \
  --exclude='.env*' \
  --exclude='tmp' \
  --exclude='temp' \
  --exclude='deployment' \
  --exclude='production-archive' \
  --exclude='production-package' \
  --exclude='test-*.js' \
  --exclude='quick-*.js' \
  --exclude='monitor-*.js' \
  --exclude='run-*.js' \
  --exclude='check-*.js' \
  --exclude='cpanel-diagnose.sh' \
  --exclude='create-production-archive.sh' \
  --exclude='Archive.zip' \
  --exclude='*.zip' \
  --exclude='*.tar.gz' \
  --exclude='.gitignore' \
  --exclude='.DS_Store' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='coverage' \
  --exclude='.nyc_output' \
  ./ "$ARCHIVE_DIR/"

# Ensure start.sh is included and executable
if [ -f "start.sh" ]; then
  cp start.sh "$ARCHIVE_DIR/start.sh"
  chmod +x "$ARCHIVE_DIR/start.sh"
  echo "   ✅ start.sh included and made executable"
fi

echo ""
echo "✅ Files copied successfully"
echo ""

# Verify critical files
echo "🔍 Verifying critical files..."
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

ALL_OK=true
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$ARCHIVE_DIR/$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file MISSING!"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = false ]; then
  echo ""
  echo "❌ ERROR: Some critical files are missing!"
  echo "   Please check the archive before deploying."
  exit 1
fi

echo ""
echo "✅ All critical files verified"
echo ""

# Create tar.gz archive
echo "📦 Creating compressed archive..."
tar -czf "$FINAL_ARCHIVE" -C "$ARCHIVE_DIR" .
echo ""

# Get archive size
ARCHIVE_SIZE=$(du -h "$FINAL_ARCHIVE" | cut -f1)
echo "✅ Archive created: $FINAL_ARCHIVE"
echo "   Size: $ARCHIVE_SIZE"
echo ""

# Create a deployment checklist
CHECKLIST_FILE="${ARCHIVE_NAME}-CHECKLIST.txt"
cat > "$CHECKLIST_FILE" << EOF
==========================================
📦 Production Deployment Checklist
==========================================

Archive: $FINAL_ARCHIVE
Size: $ARCHIVE_SIZE
Created: $(date)

==========================================
📋 Pre-Deployment Steps
==========================================

1. ✅ Archive created successfully
2. ⬜ Upload archive to cPanel
3. ⬜ Extract archive in: ~/public_html/myapp/backend/
4. ⬜ Set environment variables in cPanel Node.js App
5. ⬜ Install dependencies: npm install --production
6. ⬜ Set startup file to: start.sh
7. ⬜ Restart Node.js app

==========================================
📁 Files Included
==========================================

✅ All backend source files
✅ package.json (dependencies)
✅ start.sh (startup script)
✅ All controllers, routes, models
✅ All middleware and services
✅ All utilities and helpers

==========================================
📁 Files Excluded (Not Needed in Production)
==========================================

❌ node_modules (install on server)
❌ .git (version control)
❌ .github (CI/CD files)
❌ test files
❌ logs
❌ .md documentation files
❌ config.env (set in cPanel)
❌ Development scripts

==========================================
🚀 Deployment Instructions
==========================================

1. Upload Archive:
   - Go to cPanel → File Manager
   - Navigate to: public_html/myapp/
   - Upload: $FINAL_ARCHIVE

2. Extract Archive:
   - Right-click on $FINAL_ARCHIVE
   - Select "Extract"
   - Extract to: public_html/myapp/backend/
   - OR extract to: public_html/myapp/ and move contents to backend/

3. Install Dependencies:
   - Go to cPanel → Terminal
   - Run: cd ~/public_html/myapp/backend
   - Run: npm install --production --legacy-peer-deps

4. Set Environment Variables:
   - Go to cPanel → Node.js App
   - Click on your app
   - Add/Update environment variables:
     * STRIPE_SECRET_KEY=your_key
     * CLOUDINARY_CLOUD_NAME=your_cloud_name
     * CLOUDINARY_API_KEY=your_api_key
     * CLOUDINARY_API_SECRET=your_api_secret
     * SENDGRID_API_KEY=your_key
     * NODE_OPTIONS=--max-old-space-size=2048 --expose-gc
     * DEBUG_KEY=your_debug_key
     * (Add all other required env vars)

5. Set Startup File:
   - In cPanel → Node.js App → Your App
   - Set "Startup File" to: start.sh
   - OR set to: backend/start.sh (if extracted to root)

6. Restart App:
   - Click "Restart" in Node.js App
   - Check logs for any errors

7. Verify:
   - Check logs: cPanel → Node.js App → Logs
   - Look for: "✅ Memory limit is correctly set"
   - Test API endpoints

==========================================
🔍 Troubleshooting
==========================================

If you see errors:

1. Module not found:
   - Run: npm install --production --legacy-peer-deps
   - Check: package.json exists

2. p-limit error:
   - Run: npm install p-limit --save
   - Verify: npm list p-limit

3. Memory errors:
   - Check: NODE_OPTIONS is set correctly
   - Verify: start.sh is the startup file
   - Check: start.sh has execute permissions

4. File not found:
   - Verify: All files extracted correctly
   - Check: File paths in cPanel File Manager

==========================================
📞 Support
==========================================

If issues persist:
1. Check cPanel → Node.js App → Logs
2. Run diagnostic: bash cpanel-diagnose.sh
3. Share logs and error messages

==========================================
EOF

echo "📄 Deployment checklist created: $CHECKLIST_FILE"
echo ""

# Summary
echo "=========================================="
echo "✅ Archive Creation Complete!"
echo "=========================================="
echo ""
echo "📦 Archive: $FINAL_ARCHIVE"
echo "📄 Checklist: $CHECKLIST_FILE"
echo "📁 Archive Directory: $ARCHIVE_DIR (can be deleted)"
echo ""
echo "🚀 Next Steps:"
echo "   1. Upload $FINAL_ARCHIVE to cPanel"
echo "   2. Extract in: ~/public_html/myapp/backend/"
echo "   3. Follow instructions in $CHECKLIST_FILE"
echo ""
echo "💡 Tip: Keep $CHECKLIST_FILE for deployment reference"
echo ""

