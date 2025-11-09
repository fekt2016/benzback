# 🔴 URGENT: cPanel Memory Error - Step-by-Step Fix

## The Error You're Seeing
```
❌ UNHANDLED REJECTION! Shutting down...
RangeError: WebAssembly.instantiate(): Out of memory
```

---

## ✅ FIX IT NOW (5 Minutes)

### Step 1: Upload `start.sh` to Your Server

1. **Open cPanel File Manager**
2. **Navigate to your backend folder** (usually `public_html/myapp/backend` or similar)
3. **Check if `start.sh` exists**
   - If it doesn't exist, create it with the content from below
   - If it exists, verify it has the correct content

**Content of `start.sh`:**
```bash
#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=8192 --expose-gc"
export NODE_ENV=production
echo "🚀 Starting server with NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
exec node server.js
```

### Step 2: Make `start.sh` Executable

**In cPanel File Manager:**
1. Right-click `start.sh`
2. Click "Change Permissions"
3. Set to `755` (or check all boxes for Owner: Read, Write, Execute)
4. Click "Change Permissions"

**OR via SSH:**
```bash
cd /path/to/your/backend
chmod +x start.sh
```

### Step 3: Configure cPanel Node.js App

1. **Go to cPanel → Find "Node.js App"** (or "Node.js Selector")
2. **Click on your app** → Click "Manage" or "Edit"
3. **Find "Startup File"** (or "Application Startup File")
4. **Change it from:** `server.js`
5. **Change it to:** `start.sh`
6. **Click "Save" or "Update"**

### Step 4: Add Environment Variable

**In the same Node.js App settings:**

1. **Scroll to "Environment Variables"** section
2. **Click "Add Variable"** or the "+" button
3. **Add this variable:**
   - **Name:** `NODE_OPTIONS`
   - **Value:** `--max-old-space-size=8192 --expose-gc`
4. **Click "Save"**

### Step 5: Restart Your App

1. **Click "Restart App"** or "Reload App"
2. **Wait 15-20 seconds**
3. **Click "View Logs"** or check the logs

### Step 6: Verify It's Working

**Check your logs. You MUST see:**
```
🚀 Starting server with NODE_OPTIONS: --max-old-space-size=8192 --expose-gc
📋 Node.js version: v18.x.x
✅ NODE_OPTIONS: --max-old-space-size=8192 --expose-gc
📋 Current max memory: 8192.00MB (or close to it)
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
```

**If you see:**
```
❌ CRITICAL: NODE_OPTIONS not set!
📋 Current max memory: 512.00MB (or 1024.00MB)
```
**Then the fix didn't work - go back to Step 3 and verify `start.sh` is the startup file.**

---

## 🔧 If Your Server Has Limited RAM

If your cPanel server doesn't have 8GB available, reduce the memory:

**Edit `start.sh` and change:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"  # 4GB
```

Or:
```bash
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"  # 2GB
```

**Also update the environment variable in cPanel to match.**

---

## ❌ Common Mistakes

1. **Using `server.js` as startup file** → cPanel ignores flags
   - ✅ **Fix:** Use `start.sh` as startup file

2. **Not making `start.sh` executable** → Script won't run
   - ✅ **Fix:** Set permissions to 755

3. **Not setting environment variable** → Backup method fails
   - ✅ **Fix:** Add `NODE_OPTIONS` in cPanel

4. **Not restarting app** → Changes don't apply
   - ✅ **Fix:** Always restart after changes

---

## 📋 Quick Checklist

- [ ] `start.sh` exists in backend folder
- [ ] `start.sh` has correct content (see Step 1)
- [ ] `start.sh` is executable (permissions 755)
- [ ] cPanel Node.js App "Startup File" = `start.sh`
- [ ] Environment variable `NODE_OPTIONS` is set
- [ ] App has been restarted
- [ ] Logs show memory limit = 8192MB (or your chosen amount)
- [ ] No more "Out of memory" errors

---

## 🚨 Still Getting Errors?

### Check 1: Verify Memory Limit in Logs

After restart, check logs. If you see:
```
📋 Current max memory: 512.00MB
```

**This means the fix didn't work.** The `start.sh` script is not being used.

**Solution:**
1. Double-check "Startup File" is set to `start.sh` (not `server.js`)
2. Verify `start.sh` permissions are 755
3. Try restarting again

### Check 2: Server Resources

**Contact your hosting provider:**
- Ask: "What is the maximum RAM available for Node.js processes?"
- Ask: "Can you increase the Node.js memory limit?"
- Ask: "What Node.js version is available?"

### Check 3: Reduce Memory Requirement

If your server has limited RAM, reduce the memory in `start.sh`:
- Try 4096MB (4GB)
- Try 2048MB (2GB)
- Try 1024MB (1GB) - minimum recommended

---

## 📞 Need More Help?

1. **Check the logs** - What memory limit does it show?
2. **Verify Node.js version** - Should be v16+ (preferably v18 LTS)
3. **Contact hosting provider** - Ask about Node.js memory limits
4. **Review CPANEL_CRITICAL_FIX.md** - More detailed troubleshooting

---

**CRITICAL:** The `start.sh` script MUST be used as the startup file. This is the ONLY reliable way to ensure Node.js memory flags are applied in cPanel!

