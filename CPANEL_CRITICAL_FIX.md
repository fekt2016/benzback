# 🔴 CRITICAL: cPanel Memory Error - IMMEDIATE FIX

## The Error
```
❌ UNHANDLED REJECTION! Shutting down...
RangeError: WebAssembly.instantiate(): Out of memory
```

**Root Cause:** cPanel ignores Node.js flags in `package.json` scripts.

---

## ✅ SOLUTION: Use `start.sh` as Startup File

### Step 1: Verify `start.sh` Exists

The file `start.sh` should be in your backend folder. If not, create it with this content:

```bash
#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
export NODE_ENV=production
node server.js
```

### Step 2: Make It Executable

**In cPanel File Manager:**
1. Navigate to your backend folder
2. Right-click `start.sh`
3. Select "Change Permissions"
4. Set to `755` (or check: Read, Write, Execute for Owner)

**OR via SSH:**
```bash
chmod +x start.sh
```

### Step 3: Configure cPanel Node.js App

1. **Log into cPanel**
2. **Find "Node.js App"** or "Node.js Selector"
3. **Click on your app** → "Manage" or "Edit"
4. **Find "Startup File"** or "Application Startup File"
5. **Change from:** `server.js`
6. **Change to:** `start.sh`
7. **Click "Save" or "Update"**

### Step 4: Add Environment Variable (IMPORTANT!)

In the same Node.js App settings:

1. **Find "Environment Variables"** section
2. **Click "Add Variable"** or "+"
3. **Add:**
   - **Name:** `NODE_OPTIONS`
   - **Value:** `--max-old-space-size=4096 --expose-gc`
4. **Save**

### Step 5: Restart Your App

1. Click **"Restart App"** or **"Reload App"**
2. Wait 10-15 seconds
3. Check logs

### Step 6: Verify It's Working

**Check your logs. You MUST see:**
```
🚀 Starting server with NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.x.x
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Default max memory: 4096MB (or higher)
```

**If you see a lower memory limit (like 512MB or 1024MB), the fix didn't work!**

---

## 🔧 If It Still Doesn't Work

### Option A: Reduce Memory (Temporary)

If your cPanel server has limited RAM, reduce the memory:

**Edit `start.sh`:**
```bash
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"  # 2GB
```

Or even:
```bash
export NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"  # 1GB
```

### Option B: Check Server Resources

**Contact your hosting provider and ask:**
1. What is the maximum RAM available for Node.js processes?
2. Can they increase the limit?
3. What Node.js version is available?

### Option C: Modify server.js Directly

Add this at the VERY TOP of `server.js` (before line 1):

```javascript
// Force memory settings if not set (for cPanel)
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--max-old-space-size=4096 --expose-gc';
}
```

**Note:** This won't actually set the memory (Node.js flags must be set before process starts), but it will help verify the issue.

---

## 📋 Checklist

- [ ] `start.sh` exists in backend folder
- [ ] `start.sh` is executable (permissions 755)
- [ ] cPanel Node.js App "Startup File" is set to `start.sh`
- [ ] Environment variable `NODE_OPTIONS` is set in cPanel
- [ ] App has been restarted
- [ ] Logs show correct memory limit (4096MB or higher)
- [ ] No more "Out of memory" errors

---

## 🚨 Most Common Mistakes

1. **❌ Using `server.js` as startup file** → cPanel ignores flags
   - **✅ Use `start.sh` as startup file**

2. **❌ Not setting environment variable** → Backup method fails
   - **✅ Set `NODE_OPTIONS` in cPanel environment variables**

3. **❌ Not making `start.sh` executable** → Script won't run
   - **✅ Set permissions to 755**

4. **❌ Not restarting app** → Changes don't take effect
   - **✅ Always restart after changes**

---

## 📞 Still Having Issues?

1. **Check logs** - What memory limit does it show?
2. **Verify Node.js version** - Should be v16+ (preferably v18 LTS)
3. **Contact hosting provider** - Ask about Node.js memory limits
4. **Try reducing memory** - Start with 2048MB, then 1024MB if needed

---

**CRITICAL:** The `start.sh` script MUST be used as the startup file in cPanel. This is the only reliable way to ensure Node.js memory flags are applied!

