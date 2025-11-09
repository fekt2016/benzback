# 🚨 URGENT: Fix cPanel Memory Error NOW

## The Error
```
RangeError: WebAssembly.instantiate(): Out of memory
```

## ✅ Quick Fix (3 Steps)

### Step 1: Upload `start.sh` to Your Server
- File location: `backend/start.sh`
- Upload to same folder as `server.js` on your cPanel server

### Step 2: Change Startup File in cPanel
1. Go to **cPanel → Node.js App**
2. Click **"Manage"** on your app
3. Find **"Startup File"** or **"Application Startup File"**
4. Change from: `server.js`
5. Change to: `start.sh`
6. **Save**

### Step 3: Restart Your App
- Click **"Restart App"** in cPanel
- Wait 30 seconds
- Check logs

---

## ✅ Verify It Worked

Look at your logs. You should see:

```
🚀 Starting server with NODE_OPTIONS: --max-old-space-size=4096 --expose-gc
📋 Actual heap limit: 4096.00MB
```

**If you see:**
```
📋 Actual heap limit: 512.00MB  ❌ WRONG - start.sh not being used!
```

**Then:** Go back to Step 2 and verify the startup file is `start.sh`

---

## 🔧 If start.sh Doesn't Work

### Option A: Add Environment Variable
In cPanel Node.js App settings:
- **Name:** `NODE_OPTIONS`
- **Value:** `--max-old-space-size=4096 --expose-gc`
- **Save and Restart**

### Option B: Reduce Memory (If Server Has Low RAM)
Edit `start.sh` on server:
```bash
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"  # 2GB instead of 4GB
```

### Option C: Contact Hosting Provider
Ask them to:
1. Increase Node.js memory limit
2. Set `NODE_OPTIONS` globally
3. Check available RAM on your plan

---

## 📋 What Changed

1. ✅ Created `start.sh` - Wrapper script that sets memory flags
2. ✅ Updated `server.js` - Now detects and warns about low memory
3. ✅ Created `CPANEL_MEMORY_FIX.md` - Detailed instructions

---

## 🎯 Most Important

**The startup file MUST be `start.sh`, NOT `server.js`!**

This is the #1 reason the fix doesn't work - people forget to change the startup file.

---

**Need more help?** See `CPANEL_MEMORY_FIX.md` for detailed troubleshooting.

