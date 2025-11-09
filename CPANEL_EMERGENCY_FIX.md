# 🔴 EMERGENCY FIX: cPanel Still Showing Memory Error

## The Error
```
❌ UNHANDLED REJECTION! Shutting down...
RangeError: WebAssembly.instantiate(): Out of memory
```

**This means cPanel is STILL not applying memory settings!**

---

## ✅ SOLUTION: Use Updated start.sh

I've updated `start.sh` to use `exec node --max-old-space-size=4096 --expose-gc server.js` directly.

### Step 1: Update start.sh on Your Server

**In cPanel File Manager:**
1. Navigate to your backend folder
2. Open `start.sh` for editing
3. **Replace entire content with:**

```bash
#!/bin/bash
# cPanel Startup Script - Ensures Node.js memory flags are applied
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
export NODE_ENV=production

echo "=========================================="
echo "🚀 Starting server with memory settings"
echo "=========================================="
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
echo "📋 NODE_ENV: $NODE_ENV"
echo "=========================================="

# CRITICAL: Use exec with explicit node flags
exec node --max-old-space-size=4096 --expose-gc server.js
```

4. **Save the file**

### Step 2: Verify Permissions

1. Right-click `start.sh` → Change Permissions
2. Set to `755`
3. Save

### Step 3: Verify cPanel Settings

1. **Go to:** cPanel → Node.js App → Manage
2. **Check "Startup File":** Must be exactly `start.sh`
3. **Check Environment Variables:** 
   - `NODE_OPTIONS=--max-old-space-size=4096 --expose-gc` (should be set, but we're forcing it in script too)

### Step 4: Restart App

1. Click "Restart App"
2. Wait 20 seconds
3. Check logs

---

## 🔄 Alternative: Use server-wrapper.js

If `start.sh` still doesn't work, try using `server-wrapper.js`:

### Step 1: Upload server-wrapper.js

The file `server-wrapper.js` has been created. Upload it to your backend folder.

### Step 2: Set Permissions

```bash
chmod +x server-wrapper.js
```
Or in File Manager: Set permissions to 755

### Step 3: Change Startup File

In cPanel Node.js App:
- Change "Startup File" from `start.sh` to `server-wrapper.js`
- Save
- Restart

---

## 🔍 Verify It's Working

**Check logs. You MUST see:**
```
==========================================
🚀 Starting server with memory settings
==========================================
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.x.x
✅ NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Current max memory: 4096.00MB
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
```

**If you STILL see:**
```
📋 Current max memory: 512.00MB
❌ CRITICAL MEMORY ERROR
```

**Then cPanel is blocking Node.js flags entirely. Contact your hosting provider.**

---

## 🚨 Last Resort: Contact Hosting Provider

If nothing works, your hosting provider may be blocking Node.js flags. Ask them:

1. **"Can you enable `--max-old-space-size` flag for Node.js processes?"**
2. **"What is the maximum memory limit for Node.js apps?"**
3. **"Can you increase the Node.js memory limit for my account?"**
4. **"Do you support Node.js startup flags in cPanel?"**

---

## 📋 Quick Checklist

- [ ] `start.sh` updated with `exec node --max-old-space-size=4096 --expose-gc server.js`
- [ ] `start.sh` permissions = 755
- [ ] Startup File = `start.sh` in cPanel
- [ ] `NODE_OPTIONS` environment variable set
- [ ] App restarted
- [ ] Logs checked - memory shows 4096MB

---

**The key change:** Using `exec node --max-old-space-size=4096 --expose-gc server.js` directly in the script forces the memory limit even if cPanel ignores environment variables.

