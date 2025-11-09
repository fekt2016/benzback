# cPanel Backend Setup - Complete Checklist

## ⚠️ CRITICAL: Follow These Steps in Order

### ✅ Step 1: Verify Files Are Uploaded

In cPanel File Manager, check that these files exist in your backend folder:
- [ ] `start.sh` ✅ MUST EXIST
- [ ] `server.js` ✅ MUST EXIST
- [ ] `package.json` ✅ MUST EXIST
- [ ] `node_modules/` folder ✅ MUST EXIST (if not, run `npm install`)

### ✅ Step 2: Set start.sh Permissions

1. In File Manager, right-click `start.sh`
2. Click "Change Permissions"
3. Set to `755` (or check: Owner: Read ✅ Write ✅ Execute ✅)
4. Click "Change Permissions"

**Verify:** Permissions should show as `755` or `rwxr-xr-x`

### ✅ Step 3: Configure Node.js App

1. **Go to:** cPanel → "Node.js App" or "Node.js Selector"
2. **Click:** "Manage" or "Edit" on your app (or "Create" if new)
3. **Set these EXACT values:**

   **Application Root:**
   ```
   /home/yourusername/public_html/your-app/backend
   ```
   (Replace with your actual path - check in File Manager)

   **Application Startup File:** ⚠️ **CRITICAL**
   ```
   start.sh
   ```
   **NOT** `server.js` - MUST be exactly `start.sh`

   **Node.js Version:**
   - Select v18 LTS (or latest available)
   - Minimum: v16

### ✅ Step 4: Add Environment Variables

In the same Node.js App settings, find "Environment Variables" section:

**Click "Add Variable" for EACH of these:**

1. **NODE_OPTIONS**
   - Name: `NODE_OPTIONS`
   - Value: `--max-old-space-size=4096 --expose-gc`
   - ✅ Add

2. **NODE_ENV**
   - Name: `NODE_ENV`
   - Value: `production`
   - ✅ Add

3. **MONGO_URL**
   - Name: `MONGO_URL`
   - Value: `mongodb+srv://username:<PASSWORD>@cluster.mongodb.net/dbname`
   - ✅ Add

4. **MONGO_PASSWORD**
   - Name: `MONGO_PASSWORD`
   - Value: `your_actual_password`
   - ✅ Add

5. **JWT_SECRET**
   - Name: `JWT_SECRET`
   - Value: `your_jwt_secret`
   - ✅ Add

6. **JWT_EXPIRES_IN**
   - Name: `JWT_EXPIRES_IN`
   - Value: `90d`
   - ✅ Add

7. **JWT_COOKIE_EXPIRES_IN**
   - Name: `JWT_COOKIE_EXPIRES_IN`
   - Value: `90`
   - ✅ Add

8. **CLOUDINARY_CLOUD_NAME**
   - Name: `CLOUDINARY_CLOUD_NAME`
   - Value: `your_cloud_name`
   - ✅ Add

9. **CLOUDINARY_API_KEY**
   - Name: `CLOUDINARY_API_KEY`
   - Value: `your_api_key`
   - ✅ Add

10. **CLOUDINARY_API_SECRET**
    - Name: `CLOUDINARY_API_SECRET`
    - Value: `your_api_secret`
    - ✅ Add

11. **STRIPE_SECRET_KEY**
    - Name: `STRIPE_SECRET_KEY`
    - Value: `sk_live_...` (or `sk_test_...` for testing)
    - ✅ Add

12. **STRIPE_WEBHOOK_SECRET**
    - Name: `STRIPE_WEBHOOK_SECRET`
    - Value: `whsec_...`
    - ✅ Add

13. **SENDGRID_API_KEY**
    - Name: `SENDGRID_API_KEY`
    - Value: `SG....`
    - ✅ Add

14. **PORT**
    - Name: `PORT`
    - Value: `3001`
    - ✅ Add

15. **DEBUG_KEY** (optional but recommended)
    - Name: `DEBUG_KEY`
    - Value: `a2db84e589d7f5ed02be672a75c759e4b81cf5ba9b26151da92fd5e828eccbeb`
    - ✅ Add

**After adding all variables, click "Save" or "Update"**

### ✅ Step 5: Install Dependencies (If Not Done)

If `node_modules` folder doesn't exist or is incomplete:

1. In cPanel Terminal (or SSH):
   ```bash
   cd /path/to/your/backend
   npm install --production
   ```

2. Wait for installation to complete
3. Verify `node_modules` folder exists

### ✅ Step 6: Restart Application

1. In cPanel Node.js App settings
2. Click "Restart App" or "Reload"
3. Wait 15-20 seconds
4. Check status - should show "Running"

### ✅ Step 7: Check Logs

1. Click "View Logs" or "Error Logs"
2. Look for these messages:

**✅ SUCCESS - You should see:**
```
==========================================
🚀 Starting server with memory settings
==========================================
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.x.x
📋 NODE_ENV: production
==========================================
✅ NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.x.x
📋 Current max memory: 4096.00MB
✅ MongoDB connected: cluster0.xxxxx.mongodb.net
🚀 Server running on http://0.0.0.0:3001
🔌 Socket.io initialized
```

**❌ FAILURE - If you see:**
```
❌ CRITICAL: NODE_OPTIONS not set!
📋 Current max memory: 512.00MB
```
**→ Go back to Step 3 and verify Startup File is `start.sh`**

```
❌ MONGO_URL is not defined
```
**→ Go back to Step 4 and add missing environment variables**

```
Cannot find module 'express'
```
**→ Go back to Step 5 and run `npm install --production`**

---

## 🔍 Verification Steps

### Test 1: Check App Status
- [ ] App shows as "Running" in cPanel
- [ ] No error messages visible

### Test 2: Check Logs
- [ ] Logs show "Server running on http://0.0.0.0:3001"
- [ ] No "Out of memory" errors
- [ ] Memory limit shows as 4096MB (not 512MB)

### Test 3: Test API (If Possible)
```bash
curl http://your-domain:3001/api/v1/debug/memory \
     -H "x-debug-key: a2db84e589d7f5ed02be672a75c759e4b81cf5ba9b26151da92fd5e828eccbeb"
```

---

## 🚨 Common Mistakes

### Mistake 1: Startup File is `server.js`
**Fix:** Change to `start.sh`

### Mistake 2: `start.sh` permissions wrong
**Fix:** Set to 755

### Mistake 3: `NODE_OPTIONS` not set
**Fix:** Add environment variable

### Mistake 4: Environment variables missing
**Fix:** Add all required variables from Step 4

### Mistake 5: Dependencies not installed
**Fix:** Run `npm install --production`

### Mistake 6: Didn't restart after changes
**Fix:** Always restart app after making changes

---

## 📞 Still Not Working?

### Get Exact Error Message

1. Go to cPanel → Node.js App → View Logs
2. Copy the LAST 20-30 lines of logs
3. Look for error messages (usually in red or with ❌)

### Common Error Messages & Solutions

**"Out of memory"**
→ Startup File must be `start.sh` + `NODE_OPTIONS` must be set

**"Cannot find module"**
→ Run `npm install --production`

**"MONGO_URL is not defined"**
→ Add all environment variables

**"Permission denied"**
→ Set `start.sh` permissions to 755

**"start.sh: command not found"**
→ Verify Startup File is exactly `start.sh` (case-sensitive)

**"Port already in use"**
→ Change PORT environment variable to different number

---

## ✅ Success Indicators

Your backend is running correctly when:

1. ✅ App status shows "Running"
2. ✅ Logs show "Server running on http://0.0.0.0:3001"
3. ✅ Memory limit shows 4096MB (not 512MB)
4. ✅ No error messages in logs
5. ✅ MongoDB connection successful

---

**Most Important:** 
1. Startup File = `start.sh` (NOT `server.js`)
2. `NODE_OPTIONS` environment variable must be set
3. All required environment variables must be added

