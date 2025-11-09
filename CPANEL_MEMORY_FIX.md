# 🔴 CRITICAL: cPanel Memory Error Fix

## The Error You're Seeing

```
❌ UNHANDLED REJECTION! Shutting down...
RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance
```

**This means cPanel is NOT applying the Node.js memory flags!**

---

## ✅ SOLUTION: Use the Wrapper Script

### Step 1: Upload `start.sh` to Your Server

The file `start.sh` has been created in your backend folder. Upload it to your cPanel server in the same directory as `server.js`.

### Step 2: Make It Executable

In cPanel File Manager or via SSH:
```bash
chmod +x start.sh
```

### Step 3: Configure cPanel Node.js App

1. **Go to cPanel → Node.js App** (or "Node.js Selector")
2. **Find your app** and click "Manage" or "Edit"
3. **Find "Startup File"** or "Application Startup File"
4. **Change it from:** `server.js`
5. **Change it to:** `start.sh`
6. **Save/Update**

### Step 4: Add Environment Variable (Backup Method)

Also add this environment variable in cPanel Node.js App settings:

- **Name:** `NODE_OPTIONS`
- **Value:** `--max-old-space-size=4096 --expose-gc`

### Step 5: Restart Your App

Click "Restart App" or "Reload App" in cPanel.

### Step 6: Verify It's Working

Check your logs. You should see:
```
🚀 Starting server with NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.x.x
📋 NODE_ENV: production
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Default max memory: 4096MB (or higher)
```

**If you see a lower memory limit (like 512MB or 1024MB), the script isn't being used!**

---

## 🔧 Alternative Solutions (If start.sh Doesn't Work)

### Option A: Reduce Memory Requirement

If your cPanel server has limited RAM, reduce the memory limit:

**Edit `start.sh`:**
```bash
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"  # 2GB instead of 4GB
```

Or even:
```bash
export NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"  # 1GB
```

### Option B: Modify server.js Directly

Add this at the very top of `server.js` (before any imports):

```javascript
// Force memory settings if not set (for cPanel)
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--max-old-space-size=4096 --expose-gc';
  console.log('⚠️  NODE_OPTIONS not set, using default: 4096MB');
}

// Verify memory settings
const v8 = require('v8');
const heapLimit = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;
console.log(`📋 Actual heap limit: ${heapLimit.toFixed(2)}MB`);

if (heapLimit < 2048) {
  console.error('❌ WARNING: Heap limit is too low! Expected at least 2048MB, got:', heapLimit);
  console.error('❌ The NODE_OPTIONS environment variable is not being applied!');
  console.error('❌ Please use start.sh as the startup file in cPanel.');
}
```

### Option C: Contact Your Hosting Provider

Ask them to:
1. **Increase Node.js memory limit** for your account
2. **Verify Node.js version** (should be 16+)
3. **Check if they can set** `NODE_OPTIONS` at the server level
4. **Ask about available RAM** - you may need a higher-tier plan

---

## 🎯 Quick Verification Checklist

After applying the fix, check your logs for:

- [ ] ✅ `NODE_OPTIONS` is logged (should show the flags)
- [ ] ✅ Heap limit is 4096MB or higher (not 512MB or 1024MB)
- [ ] ✅ Server starts without the WebAssembly error
- [ ] ✅ Memory logs appear every minute (in production mode)

---

## 📊 Expected Log Output (Success)

```
🚀 Starting server with NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Node.js version: v18.20.0
📋 NODE_ENV: production
📋 NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Default max memory: 4096.00MB
✅ All critical environment variables are present.
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
🔌 Socket.io initialized
💾 Memory: Heap 45.23MB / 200.45MB, RSS: 120.50MB
```

---

## ❌ If You Still See the Error

### Check 1: Is start.sh Being Used?

Look at the very first line of your logs. If you DON'T see:
```
🚀 Starting server with NODE_OPTIONS: ...
```

Then `start.sh` is NOT being used. Go back to Step 3 and verify the startup file is set to `start.sh`.

### Check 2: What's the Actual Memory Limit?

Look for this line in logs:
```
📋 Default max memory: XXX.XXMB
```

If it shows **512MB, 1024MB, or 2048MB** (less than 4096MB), the flags aren't being applied.

### Check 3: Contact Support

If nothing works:
1. **Screenshot your cPanel Node.js App settings**
2. **Copy the first 20 lines of your error logs**
3. **Contact your hosting provider** with:
   - The error message
   - What you've tried
   - Request to increase Node.js memory limit
   - Ask if they can set `NODE_OPTIONS` globally

---

## 🔍 Additional Optimizations (If Memory Still Low)

If your server has very limited RAM, we can optimize further:

1. **Reduce MongoDB connection pool:**
   ```javascript
   maxPoolSize: 5  // Instead of 10
   ```

2. **Reduce pagination limits:**
   ```javascript
   const limitNum = Math.min(parseInt(limit) || 50, 50); // Max 50 instead of 100
   ```

3. **Disable memory monitoring** (saves a bit of memory):
   ```javascript
   // Comment out the memory monitoring interval in server.js
   ```

But **first, try the start.sh solution** - it should fix the issue!

---

## 📝 Summary

**The Problem:** cPanel ignores Node.js flags in package.json

**The Solution:** Use `start.sh` as the startup file in cPanel

**Steps:**
1. Upload `start.sh` to server
2. Make it executable: `chmod +x start.sh`
3. Set startup file to `start.sh` in cPanel
4. Add `NODE_OPTIONS` environment variable
5. Restart app
6. Verify in logs

---

**Most Important:** The startup file MUST be `start.sh`, not `server.js`!

