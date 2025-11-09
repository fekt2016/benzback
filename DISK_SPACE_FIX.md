# Disk Space Full - Deployment Optimization

## 🔴 Problem

FTP Error: `552 Disk full - please upload later`

Your server doesn't have enough disk space to deploy all files.

---

## ✅ Solution: Minimal Deployment

I've optimized the workflow to deploy ONLY essential files:

### What Gets Deployed (Minimal)
- ✅ `start.sh` - Critical for cPanel
- ✅ `server.js` - Main server file
- ✅ `app.js` - Express app
- ✅ `package.json` - Dependencies list
- ✅ `package-lock.json` - Lock file
- ✅ `controllers/` - All controllers
- ✅ `routes/` - All routes
- ✅ `models/` - All models
- ✅ `middleware/` - All middleware
- ✅ `utils/` - All utilities
- ✅ `services/` - All services
- ✅ `socket/` - Socket.io files

### What's Excluded (To Save Space)
- ❌ `node_modules/` - Install on server instead
- ❌ `*.md` - Documentation files
- ❌ `test-*.js`, `quick-*.js`, `monitor-*.js` - Test scripts
- ❌ `scripts/` - Utility scripts
- ❌ `*.log` - Log files
- ❌ `Archive.zip` - Archive files
- ❌ `config.env` - Use cPanel env vars instead

---

## 📋 After Deployment

### Step 1: Clean Up Server (If Needed)

**In cPanel File Manager or SSH:**
```bash
cd /home/username/public_html/myapp
# Remove old files if needed
# Check disk space
df -h
```

### Step 2: Install Dependencies on Server

**Since `node_modules` is not deployed, install on server:**

1. **Go to cPanel Terminal** (or SSH)
2. **Run:**
   ```bash
   cd /home/username/public_html/myapp
   npm install --production
   ```

This will install dependencies directly on the server (saves deployment size).

### Step 3: Set start.sh Permissions

1. **cPanel → File Manager → `public_html/myapp/`**
2. **Right-click `start.sh` → Change Permissions → 755**

### Step 4: Verify cPanel Node.js App

- Startup File: `start.sh`
- Application Root: `/home/username/public_html/myapp`
- Environment Variables: All set

### Step 5: Restart App

- Click "Restart App" in cPanel
- Check logs

---

## 🔍 Check Server Disk Space

**If you have SSH access:**
```bash
df -h
du -sh /home/username/public_html/myapp
```

**In cPanel:**
- Go to "Disk Usage" or "Disk Space Usage"
- Check available space
- Clean up if needed

---

## 💡 Additional Space-Saving Tips

### 1. Remove Old Files
- Delete old backups
- Remove unused files
- Clean up logs

### 2. Optimize Deployment
- The workflow now deploys minimal files
- `node_modules` excluded (install on server)
- Documentation excluded

### 3. Clean Up Before Deploying
```bash
# On server (if you have SSH)
cd /home/username/public_html/myapp
rm -rf node_modules  # Will be reinstalled
rm -f *.log
rm -f *.md
```

---

## ✅ Workflow Changes

The workflow now:
1. ✅ Deploys only essential files
2. ✅ Excludes `node_modules` (saves ~100-200MB)
3. ✅ Excludes documentation (saves ~5-10MB)
4. ✅ Excludes test scripts (saves ~2-5MB)
5. ✅ Shows deployment size before upload

**Expected deployment size:** ~5-10MB (instead of 100-200MB with node_modules)

---

## 🚀 Retry Deployment

After cleaning up server space:

1. **Check available disk space** (should have at least 50MB free)
2. **Push again:**
   ```bash
   git push origin main
   ```
3. **Monitor GitHub Actions** - should complete successfully
4. **Install dependencies on server** after deployment

---

**The workflow is now optimized for minimal deployment size!**

