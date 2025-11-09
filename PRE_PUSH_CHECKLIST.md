# 🚀 Pre-Push Production Checklist

## ✅ Final Verification Before Pushing

### 1. GitHub Secrets (Required)

Go to: GitHub Repo → Settings → Secrets and variables → Actions

Verify these secrets are set:
- [ ] `FTP_SERVER` - Your FTP server address
- [ ] `FTP_USERNAME` - FTP username
- [ ] `FTP_PASSWORD` - FTP password

**To add if missing:**
1. Click "New repository secret"
2. Add each secret
3. Save

---

### 2. Workflow Configuration

Verify in `.github/workflows/deploy.yml`:
- [ ] Server directory: `public_html/myapp/` ✅
- [ ] Branch: `main` ✅
- [ ] Node.js version: `18` ✅
- [ ] `config.env` excluded ✅
- [ ] `start.sh` included ✅

---

### 3. Code Changes

Verify all changes are committed:
- [ ] `start.sh` updated (3GB memory for CloudLinux)
- [ ] `package.json` updated (3GB memory)
- [ ] `server.js` updated (3GB memory)
- [ ] All other code changes committed

**Check status:**
```bash
git status
```

**If uncommitted changes:**
```bash
git add .
git commit -m "Production ready: CloudLinux LVE 3GB memory limit"
```

---

### 4. Push to Production

**Push to main branch:**
```bash
git push origin main
```

**Or if you're on a different branch:**
```bash
git checkout main
git merge your-branch
git push origin main
```

---

## 📋 After Deployment

### Step 1: Monitor GitHub Actions

1. Go to GitHub repo → Actions tab
2. Watch the deployment workflow
3. Wait for "✅ Deploy to Production" to complete

**If it fails:**
- Check the error message
- Verify FTP secrets are correct
- Check server directory path

---

### Step 2: Set start.sh Permissions

1. **Go to cPanel → File Manager**
2. **Navigate to:** `public_html/myapp/`
3. **Find `start.sh`**
4. **Right-click → Change Permissions**
5. **Set to:** `755` (or check: Owner: Read ✅ Write ✅ Execute ✅)
6. **Save**

---

### Step 3: Verify cPanel Node.js App

1. **Go to:** cPanel → Node.js App
2. **Click:** "Manage" on your app
3. **Verify:**
   - **Application Root:** `/home/username/public_html/myapp`
   - **Startup File:** `start.sh` (NOT `server.js`)
   - **Node.js Version:** v18 LTS

---

### Step 4: Verify Environment Variables

In cPanel Node.js App → Environment Variables, verify:

**Critical:**
- [ ] `NODE_OPTIONS=--max-old-space-size=3072 --expose-gc` (3GB for CloudLinux)
- [ ] `NODE_ENV=production`

**Required:**
- [ ] `MONGO_URL=...`
- [ ] `MONGO_PASSWORD=...`
- [ ] `JWT_SECRET=...`
- [ ] `JWT_EXPIRES_IN=90d`
- [ ] `JWT_COOKIE_EXPIRES_IN=90`
- [ ] `CLOUDINARY_CLOUD_NAME=...`
- [ ] `CLOUDINARY_API_KEY=...`
- [ ] `CLOUDINARY_API_SECRET=...`
- [ ] `STRIPE_SECRET_KEY=...`
- [ ] `STRIPE_WEBHOOK_SECRET=...`
- [ ] `SENDGRID_API_KEY=...`
- [ ] `PORT=3001`
- [ ] `DEBUG_KEY=...`

---

### Step 5: Install Dependencies (If Needed)

If `node_modules` wasn't deployed:

1. **Go to cPanel Terminal** (or SSH)
2. **Run:**
   ```bash
   cd /home/username/public_html/myapp
   npm install --production
   ```

---

### Step 6: Restart App

1. **In cPanel Node.js App**
2. **Click:** "Restart App" or "Reload"
3. **Wait:** 20 seconds
4. **Check:** Status should show "Running"

---

### Step 7: Verify Deployment

**Check logs in cPanel Node.js App:**

**✅ Success indicators:**
```
==========================================
🚀 Starting server with memory settings
==========================================
📋 NODE_OPTIONS: --max-old-space-size=3072 --expose-gc
📋 Current max memory: 3072.00MB  ← Should show 3072MB
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
🔌 Socket.io initialized
```

**❌ If you see:**
```
📋 Current max memory: 512.00MB
❌ CRITICAL MEMORY ERROR
```
→ `start.sh` is not being used. Check Startup File setting.

---

## 🚨 Troubleshooting

### Deployment Failed

**Check GitHub Actions logs:**
- FTP connection error? → Verify FTP secrets
- File not found? → Check server directory path
- Permission denied? → Check FTP credentials

### Server Won't Start

**Check cPanel logs:**
- "Permission denied" → Set `start.sh` permissions to 755
- "Out of memory" → Verify `NODE_OPTIONS` is set
- "Cannot find module" → Run `npm install --production`

### Memory Error Still Occurs

**If you still get memory error:**
1. Verify `start.sh` is the Startup File (not `server.js`)
2. Verify `NODE_OPTIONS=--max-old-space-size=3072 --expose-gc` is set
3. Check logs for actual memory limit shown
4. If still 512MB, contact hosting provider about LVE limits

---

## ✅ Success Checklist

After deployment, verify:
- [ ] GitHub Actions workflow completed successfully
- [ ] Files deployed to `public_html/myapp/`
- [ ] `start.sh` exists and has 755 permissions
- [ ] cPanel Node.js App Startup File = `start.sh`
- [ ] All environment variables set
- [ ] App restarted
- [ ] Logs show: `📋 Current max memory: 3072.00MB`
- [ ] Logs show: `🚀 Server running on http://0.0.0.0:3001`
- [ ] No memory errors

---

## 🎯 Quick Commands

**Push to production:**
```bash
git push origin main
```

**Check deployment status:**
- GitHub → Actions tab → Latest workflow run

**Check server logs:**
- cPanel → Node.js App → View Logs

---

**Ready to push!** 🚀

Make sure GitHub secrets are set, then:
```bash
git push origin main
```

