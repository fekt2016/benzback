# GitHub Actions Workflow Review & Fixes

## ✅ Issues Found & Fixed

### 🔴 Critical Issues (Fixed)

1. **config.env Being Deployed** ❌ → ✅ FIXED
   - **Problem:** `config.env` contains secrets and was being deployed
   - **Risk:** Secrets exposed in production
   - **Fix:** Added `--exclude='config.env'` and `*.env` to rsync and FTP exclude

2. **start.sh Not Guaranteed** ❌ → ✅ FIXED
   - **Problem:** `start.sh` might be excluded by `*.sh` pattern
   - **Risk:** Critical file missing, server won't start
   - **Fix:** Explicitly copy `start.sh` and use `!start.sh` in FTP exclude

3. **Wrong Server Directory** ⚠️ → ✅ FIXED
   - **Problem:** Deploying to `public_html/myapp/` instead of `public_html/myapp/backend/`
   - **Risk:** Files in wrong location
   - **Fix:** Changed to `public_html/myapp/backend/`

4. **Missing Post-Deployment Steps** ⚠️ → ✅ FIXED
   - **Problem:** No reminder to set `start.sh` permissions
   - **Risk:** Server won't start (permission denied)
   - **Fix:** Added post-deployment checklist

---

## ✅ Improvements Made

### Security
- ✅ Excludes `config.env` and all `.env` files
- ✅ Excludes test files and scripts
- ✅ Excludes documentation files (`.md`)
- ✅ Excludes log files

### Reliability
- ✅ Explicitly includes `start.sh` (critical for cPanel)
- ✅ Verifies critical files before deployment
- ✅ Sets executable permission on `start.sh` locally
- ✅ Correct server directory path

### Documentation
- ✅ Added post-deployment checklist
- ✅ Clear instructions for cPanel setup
- ✅ Reminders about environment variables

---

## 📋 Pre-Deployment Checklist

Before pushing to `main` branch:

### GitHub Secrets Required
- [ ] `FTP_SERVER` - Your FTP server address
- [ ] `FTP_USERNAME` - FTP username
- [ ] `FTP_PASSWORD` - FTP password

**To add secrets:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret

### Verify These in Workflow
- [ ] Server directory: `public_html/myapp/backend/` (matches your cPanel setup)
- [ ] Branch: `main` (or change if using different branch)
- [ ] Node.js version: `18` (matches your server)

---

## 📋 Post-Deployment Checklist

After deployment completes:

### Step 1: Set start.sh Permissions
1. Go to cPanel → File Manager
2. Navigate to `public_html/myapp/backend/`
3. Right-click `start.sh` → Change Permissions
4. Set to `755` (or check: Owner: Read ✅ Write ✅ Execute ✅)

### Step 2: Verify cPanel Node.js App
1. Go to cPanel → Node.js App
2. Click "Manage" on your app
3. Verify:
   - **Startup File:** `start.sh` (NOT `server.js`)
   - **Application Root:** `/home/username/public_html/myapp/backend`
   - **Environment Variables:** All set (see below)

### Step 3: Verify Environment Variables
In cPanel Node.js App → Environment Variables, ensure:
- `NODE_OPTIONS=--max-old-space-size=3072 --expose-gc` (3GB for CloudLinux)
- `NODE_ENV=production`
- `MONGO_URL=...`
- `MONGO_PASSWORD=...`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=90d`
- `JWT_COOKIE_EXPIRES_IN=90`
- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `SENDGRID_API_KEY=...`
- `PORT=3001`
- `DEBUG_KEY=...`

### Step 4: Install Dependencies (If Needed)
If `node_modules` wasn't deployed:
```bash
cd /path/to/public_html/myapp/backend
npm install --production
```

### Step 5: Restart App
1. In cPanel Node.js App
2. Click "Restart App"
3. Wait 20 seconds
4. Check logs

### Step 5: Verify Deployment
Check logs for:
```
✅ NODE_OPTIONS: --max-old-space-size=3072 --expose-gc
📋 Current max memory: 3072.00MB
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
```

---

## 🔍 What Gets Deployed

### ✅ Included Files
- All source code (`controllers/`, `routes/`, `models/`, etc.)
- `server.js`, `app.js`, `package.json`
- `start.sh` ⚠️ **CRITICAL**
- `node_modules/` (if installed locally, but better to install on server)

### ❌ Excluded Files (Security & Cleanup)
- `config.env` - Contains secrets (use cPanel env vars instead)
- `*.env` - All environment files
- `*.log` - Log files
- `*.md` - Documentation files
- `test-*.js`, `quick-*.js`, `monitor-*.js` - Test/monitoring scripts
- `.git/`, `.github/` - Version control
- `deployment/` - Deployment artifacts

---

## 🚨 Important Notes

### 1. Environment Variables
**DO NOT** deploy `config.env` to production. Instead:
- Set all environment variables in cPanel Node.js App settings
- This is more secure and easier to manage

### 2. start.sh Permissions
**MUST** be set to `755` after deployment:
- GitHub Actions can't set FTP file permissions
- Do this manually in cPanel File Manager
- Without executable permission, server won't start

### 3. node_modules
**Options:**
- **Option A:** Deploy `node_modules` (larger upload, but works immediately)
- **Option B:** Install on server after deployment (recommended):
  ```bash
  cd /path/to/backend
  npm install --production
  ```

### 4. CloudLinux LVE Memory
**Remember:** Your server has 4GB LVE limit, so:
- Use `NODE_OPTIONS=--max-old-space-size=3072 --expose-gc` (3GB)
- This leaves room for WebAssembly/undici

---

## 🔧 Customization

### Change Server Directory
If your backend is in a different location, update line 72:
```yaml
server-dir: public_html/myapp/backend/  # Change this
```

### Change Branch
To deploy from a different branch, update line 5:
```yaml
branches: [main]  # Change to [production], [master], etc.
```

### Include node_modules
If you want to deploy `node_modules` (not recommended - large upload):
- Remove `--exclude='node_modules'` from rsync
- Remove `node_modules/**` from FTP exclude

---

## ✅ Verification

After deployment, verify:

1. **Files Deployed:**
   ```bash
   # Check via FTP or cPanel File Manager
   ls -la /path/to/public_html/myapp/backend/
   # Should see: start.sh, server.js, app.js, package.json, etc.
   ```

2. **start.sh Exists:**
   ```bash
   [ -f /path/to/backend/start.sh ] && echo "✅ start.sh exists" || echo "❌ MISSING!"
   ```

3. **config.env NOT Deployed:**
   ```bash
   [ ! -f /path/to/backend/config.env ] && echo "✅ config.env excluded (good)" || echo "⚠️  config.env found (should be excluded!)"
   ```

---

## 🎯 Summary

**Status:** ✅ **READY FOR PRODUCTION** (after fixes)

**Key Changes:**
1. ✅ Excludes `config.env` (security)
2. ✅ Explicitly includes `start.sh` (critical)
3. ✅ Correct server directory path
4. ✅ Post-deployment checklist added

**Before Pushing:**
- [ ] Verify GitHub secrets are set
- [ ] Verify server directory path is correct
- [ ] Review excluded files list

**After Deployment:**
- [ ] Set `start.sh` permissions to 755
- [ ] Verify cPanel Node.js App settings
- [ ] Restart app and check logs

---

**The workflow is now production-ready!** 🚀

