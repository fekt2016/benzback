# Deploying to cPanel - Complete File Checklist

## ✅ Files You MUST Upload to cPanel

### Critical Files (Required)

1. **`start.sh`** ⚠️ **MOST IMPORTANT**
   - **Location:** Must be in your backend folder root
   - **Purpose:** Sets memory limits that cPanel ignores
   - **Permissions:** Must be 755 (executable)
   - **Status:** ✅ MUST BE UPLOADED

2. **`server.js`**
   - **Location:** Backend folder root
   - **Purpose:** Main server file
   - **Status:** ✅ MUST BE UPLOADED

3. **`app.js`**
   - **Location:** Backend folder root
   - **Purpose:** Express app configuration
   - **Status:** ✅ MUST BE UPLOADED

4. **`package.json`**
   - **Location:** Backend folder root
   - **Purpose:** Dependencies list
   - **Status:** ✅ MUST BE UPLOADED

5. **`node_modules/`** folder
   - **Location:** Backend folder root
   - **Purpose:** Installed dependencies
   - **Status:** ✅ MUST BE UPLOADED (or install with `npm install --production`)

### Configuration Files

6. **`config.env`** (Optional - use cPanel environment variables instead)
   - **Location:** Backend folder root
   - **Purpose:** Environment variables (but use cPanel env vars instead)
   - **Status:** ⚠️ Optional (prefer cPanel environment variables)

### All Other Backend Files

- ✅ All files in `controllers/` folder
- ✅ All files in `routes/` folder
- ✅ All files in `models/` folder
- ✅ All files in `middleware/` folder
- ✅ All files in `utils/` folder
- ✅ All files in `services/` folder
- ✅ All files in `socket/` folder

---

## 📤 How to Upload Files

### Option 1: cPanel File Manager

1. **Log into cPanel**
2. **Open File Manager**
3. **Navigate to your backend folder** (e.g., `public_html/myapp/backend`)
4. **Upload `start.sh`:**
   - Click "Upload" button
   - Select `start.sh` from your local computer
   - Wait for upload to complete
5. **Set Permissions:**
   - Right-click `start.sh`
   - Click "Change Permissions"
   - Set to `755` (or check: Owner: Read ✅ Write ✅ Execute ✅)
   - Click "Change Permissions"

### Option 2: FTP/SFTP

```bash
# Using FTP client (FileZilla, etc.)
# Upload start.sh to: /home/username/public_html/myapp/backend/

# Then set permissions via SSH:
chmod +x /path/to/backend/start.sh
```

### Option 3: Git (If Using Version Control)

```bash
# If you have Git on cPanel server
cd /path/to/backend
git pull origin main
chmod +x start.sh
```

---

## 🔍 Verify Files Are Uploaded

### In cPanel File Manager, check:

- [ ] `start.sh` exists in backend folder
- [ ] `start.sh` permissions show as `755` or `rwxr-xr-x`
- [ ] `server.js` exists
- [ ] `package.json` exists
- [ ] `node_modules/` folder exists (or will install it)

---

## ⚠️ CRITICAL: After Uploading start.sh

### Step 1: Set Permissions
- Right-click `start.sh` → Change Permissions → Set to `755`

### Step 2: Configure cPanel Node.js App
1. Go to: cPanel → Node.js App
2. Click "Manage" on your app
3. **Set "Startup File" to:** `start.sh` (NOT `server.js`)
4. **Add Environment Variable:**
   - Name: `NODE_OPTIONS`
   - Value: `--max-old-space-size=4096 --expose-gc`
5. Save

### Step 3: Restart App
- Click "Restart App"
- Wait 20 seconds
- Check logs

---

## 📋 Complete Deployment Checklist

### Before Uploading
- [ ] All code changes committed
- [ ] `start.sh` is updated with latest version
- [ ] All environment variables documented

### Upload Files
- [ ] Upload entire backend folder
- [ ] Verify `start.sh` is uploaded
- [ ] Set `start.sh` permissions to 755

### cPanel Configuration
- [ ] Startup File = `start.sh`
- [ ] `NODE_OPTIONS` environment variable set
- [ ] All other environment variables set
- [ ] Node.js version selected (v18 LTS)

### After Deployment
- [ ] App restarted
- [ ] Logs checked
- [ ] Memory limit shows 4096MB (not 512MB)
- [ ] Server running successfully

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Forgot to Upload start.sh
**Result:** Server crashes with "Out of memory" error
**Fix:** Upload `start.sh` and set permissions

### ❌ Mistake 2: Wrong Permissions
**Result:** "Permission denied" error
**Fix:** Set permissions to 755

### ❌ Mistake 3: Startup File is server.js
**Result:** Memory flags not applied
**Fix:** Change to `start.sh`

### ❌ Mistake 4: start.sh Not in Backend Root
**Result:** cPanel can't find the file
**Fix:** Ensure `start.sh` is in same folder as `server.js`

---

## ✅ Success Indicators

After uploading and configuring, you should see in logs:

```
==========================================
🚀 Starting server with memory settings
==========================================
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Current max memory: 4096.00MB  ← This is the key!
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
```

---

**YES - You MUST upload `start.sh` to production!** It's the most critical file for cPanel deployment.

