# cPanel Quick Start - Get Backend Running in 5 Minutes

## 🚀 Fast Setup (Copy-Paste Ready)

### Step 1: Upload Files
1. Upload your entire `backend` folder to cPanel
2. Ensure `start.sh` is in the backend root folder

### Step 2: Set Permissions
In cPanel File Manager:
- Right-click `start.sh` → Change Permissions → Set to `755`

### Step 3: Install Dependencies
In cPanel Terminal (or SSH):
```bash
cd /path/to/backend
npm install --production
```

### Step 4: Configure Node.js App in cPanel

1. **Go to:** cPanel → Node.js App (or "Node.js Selector")
2. **Click:** "Create Application" or "Manage" existing app
3. **Set these values:**

   **Application Root:** `/home/username/public_html/myapp/backend`
   (Replace with your actual path)

   **Application URL:** `your-domain.com` (or subdomain)

   **Application Startup File:** `start.sh` ⚠️ **IMPORTANT: Must be start.sh, NOT server.js**

   **Node.js Version:** Select v18 LTS (or latest available)

4. **Environment Variables:** Click "Add Variable" for each:

   ```
   NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
   NODE_ENV=production
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
   PORT=3001
   DEBUG_KEY=a2db84e589d7f5ed02be672a75c759e4b81cf5ba9b26151da92fd5e828eccbeb
   ```

5. **Click:** "Save" or "Create"

### Step 5: Restart App
- Click "Restart App" or "Reload"
- Wait 15-20 seconds

### Step 6: Check Logs
- Click "View Logs" or "Error Logs"
- Look for:
  ```
  ✅ MongoDB connected: ...
  🚀 Server running on http://0.0.0.0:3001
  ```

---

## ❌ If It Still Doesn't Work

### Check Logs for These Errors:

**Error 1: "Out of memory"**
```
❌ Solution: Verify NODE_OPTIONS is set in environment variables
```

**Error 2: "Cannot find module"**
```
❌ Solution: Run npm install --production in backend folder
```

**Error 3: "MONGO_URL is not defined"**
```
❌ Solution: Add all environment variables in cPanel
```

**Error 4: "Permission denied"**
```
❌ Solution: Set start.sh permissions to 755
```

**Error 5: "start.sh: command not found"**
```
❌ Solution: Verify Startup File is exactly "start.sh" (not "server.js")
```

---

## 🔍 Verify Setup

### Checklist:
- [ ] `start.sh` exists in backend folder
- [ ] `start.sh` permissions are 755
- [ ] Startup File = `start.sh` (NOT `server.js`)
- [ ] `NODE_OPTIONS` environment variable is set
- [ ] All required environment variables are set
- [ ] `node_modules` folder exists
- [ ] App has been restarted
- [ ] Logs show server running

---

## 📞 Need Help?

1. **Check Logs First** - Most errors are visible there
2. **Verify Startup File** - Must be `start.sh`
3. **Check Environment Variables** - All must be set
4. **Contact Hosting Provider** - Ask about Node.js support

---

**Most Important:** Startup File MUST be `start.sh`, not `server.js`!

