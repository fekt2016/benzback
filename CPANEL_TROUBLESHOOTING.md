# cPanel Backend Not Running - Complete Troubleshooting Guide

## 🔴 Common Issues & Solutions

### Issue 1: Memory Error (Most Common)
**Error:** `RangeError: WebAssembly.instantiate(): Out of memory`

**Solution:**
1. **Use `start.sh` as Startup File**
   - Go to cPanel → Node.js App
   - Click "Manage" on your app
   - Find "Startup File" or "Application Startup File"
   - Change from `server.js` to `start.sh`
   - Save

2. **Set Environment Variable**
   - In same Node.js App settings
   - Find "Environment Variables"
   - Add: `NODE_OPTIONS=--max-old-space-size=4096 --expose-gc`
   - Save

3. **Make start.sh Executable**
   - In cPanel File Manager
   - Navigate to backend folder
   - Right-click `start.sh` → Change Permissions
   - Set to `755` (or check Read, Write, Execute for Owner)

4. **Restart App**
   - Click "Restart App" in cPanel
   - Wait 15-20 seconds
   - Check logs

---

### Issue 2: Environment Variables Not Set

**Symptoms:**
- Server starts but crashes immediately
- Errors about missing MONGO_URL, JWT_SECRET, etc.

**Solution:**
1. **Check Required Variables**
   In cPanel Node.js App → Environment Variables, ensure these are set:
   ```
   MONGO_URL=mongodb+srv://username:<PASSWORD>@cluster.mongodb.net/dbname
   MONGO_PASSWORD=your_password
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=90d
   JWT_COOKIE_EXPIRES_IN=90
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   SENDGRID_API_KEY=SG....
   NODE_ENV=production
   PORT=3001
   DEBUG_KEY=your_debug_key
   ```

2. **Copy from config.env**
   - Open your local `config.env` file
   - Copy all variables
   - Paste into cPanel environment variables (one per line)

---

### Issue 3: Wrong Startup File

**Symptoms:**
- App shows as "running" but doesn't respond
- No logs appearing
- 502 errors

**Solution:**
1. **Verify Startup File**
   - Must be: `start.sh` (NOT `server.js`)
   - Check in cPanel Node.js App settings

2. **Verify File Exists**
   - In File Manager, check that `start.sh` exists in backend folder
   - Should be in same directory as `server.js`

---

### Issue 4: Node.js Version Mismatch

**Symptoms:**
- Syntax errors
- Module not found errors
- Incompatible features

**Solution:**
1. **Check Node.js Version in cPanel**
   - Go to Node.js App settings
   - Check "Node.js Version"
   - Should be v16+ (preferably v18 LTS)

2. **Update if Needed**
   - Select a newer version
   - Restart app

---

### Issue 5: Path Issues

**Symptoms:**
- "Cannot find module"
- "File not found"
- Module resolution errors

**Solution:**
1. **Check Application Root**
   - In cPanel Node.js App
   - Verify "Application Root" points to your backend folder
   - Should be: `public_html/myapp/backend` or similar

2. **Check File Locations**
   - `start.sh` should be in backend root
   - `server.js` should be in backend root
   - `package.json` should be in backend root
   - `node_modules` should be in backend root

---

### Issue 6: Dependencies Not Installed

**Symptoms:**
- "Cannot find module 'express'"
- "Module not found" errors

**Solution:**
1. **Install Dependencies**
   - In cPanel Terminal or SSH:
   ```bash
   cd /path/to/your/backend
   npm install --production
   ```

2. **Verify node_modules**
   - Check that `node_modules` folder exists
   - Should contain all dependencies

---

### Issue 7: Port Already in Use

**Symptoms:**
- "EADDRINUSE: address already in use"
- Port conflict errors

**Solution:**
1. **Check Port in Environment**
   - Verify `PORT=3001` in environment variables
   - Or use a different port if 3001 is taken

2. **Kill Existing Process** (if you have SSH access)
   ```bash
   lsof -ti:3001 | xargs kill -9
   ```

---

## 🔍 Step-by-Step Verification

### Step 1: Check cPanel Node.js App Settings

1. **Startup File:** Must be `start.sh`
2. **Application Root:** Points to backend folder
3. **Node.js Version:** v16+ (preferably v18)
4. **Environment Variables:** All required vars set

### Step 2: Verify Files

In cPanel File Manager, check:
- ✅ `start.sh` exists in backend folder
- ✅ `start.sh` permissions are 755
- ✅ `server.js` exists
- ✅ `package.json` exists
- ✅ `node_modules` folder exists

### Step 3: Check Logs

1. **View Application Logs**
   - In cPanel Node.js App
   - Click "View Logs" or "Error Logs"
   - Look for error messages

2. **Common Log Messages:**

   **✅ Good (Server Starting):**
   ```
   🚀 Starting server with NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
   📋 Node.js version: v18.x.x
   ✅ MongoDB connected: ...
   🚀 Server running on http://0.0.0.0:3001
   ```

   **❌ Bad (Memory Error):**
   ```
   ❌ CRITICAL: NODE_OPTIONS not set!
   📋 Current max memory: 512.00MB
   RangeError: WebAssembly.instantiate(): Out of memory
   ```

   **❌ Bad (Missing Env Vars):**
   ```
   ❌ MONGO_URL is not defined in environment variables
   ```

---

## 🛠️ Complete Setup Checklist

### Pre-Deployment
- [ ] All environment variables copied to cPanel
- [ ] `start.sh` uploaded to backend folder
- [ ] `start.sh` permissions set to 755
- [ ] Dependencies installed (`npm install --production`)
- [ ] Node.js version selected (v18 LTS recommended)

### cPanel Configuration
- [ ] Startup File set to: `start.sh`
- [ ] Application Root points to backend folder
- [ ] Environment variable `NODE_OPTIONS` set: `--max-old-space-size=4096 --expose-gc`
- [ ] All required environment variables added
- [ ] Node.js version is v16+ (preferably v18)

### Post-Deployment
- [ ] App restarted
- [ ] Logs checked for errors
- [ ] Server responds to requests
- [ ] Memory logs appear (every minute in production)

---

## 📋 Quick Fix Commands (If You Have SSH Access)

```bash
# Navigate to backend
cd /path/to/your/backend

# Make start.sh executable
chmod +x start.sh

# Install dependencies
npm install --production

# Check Node.js version
node --version

# Test start.sh manually
./start.sh
```

---

## 🔧 Manual Test (SSH/Terminal)

If you have SSH access, test manually:

```bash
cd /path/to/your/backend

# Set environment variables
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
export NODE_ENV="production"
# ... set other env vars ...

# Test server start
node server.js
```

If this works, the issue is with cPanel configuration, not your code.

---

## 📞 Still Not Working?

### Check These:

1. **Contact Hosting Provider:**
   - Ask about Node.js memory limits
   - Ask about available Node.js versions
   - Ask if they support `--max-old-space-size` flag

2. **Check Server Resources:**
   - Verify server has enough RAM
   - Check if there are resource limits

3. **Alternative: Reduce Memory:**
   If 4GB is too much, try 2GB:
   ```bash
   NODE_OPTIONS=--max-old-space-size=2048 --expose-gc
   ```

4. **Check Logs for Specific Errors:**
   - Copy exact error message
   - Search for solution online
   - Check Node.js version compatibility

---

## ✅ Success Indicators

Your backend is running correctly when you see:

1. **In Logs:**
   ```
   ✅ MongoDB connected: ...
   🚀 Server running on http://0.0.0.0:3001
   💾 Memory: Heap 200.23MB / 400.45MB, RSS: 250.50MB
   ```

2. **App Status:**
   - Shows as "Running" in cPanel
   - No error messages in logs

3. **API Response:**
   ```bash
   curl http://your-domain:3001/api/v1/health
   # Should return response (if health endpoint exists)
   ```

---

**Most Common Fix:** Use `start.sh` as startup file + Set `NODE_OPTIONS` environment variable!

