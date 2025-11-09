# CloudLinux LVE Memory Limit Fix

## 🔍 Problem Identified

Your server is running **CloudLinux with LVE (Lightweight Virtual Environment) limits**.

**The Issue:**
- ✅ Node.js memory flags ARE working (shows 4144MB)
- ❌ But CloudLinux LVE "Max resident set" limit is **4GB** (4294967296 bytes)
- ❌ WebAssembly (undici) tries to allocate memory but hits the LVE limit
- ❌ Error: "Out of memory error may be caused by hitting LVE limits"

**From your logs:**
```
Max resident set: 4294967296 bytes = 4GB
Current max memory: 4144.00MB (too close to 4GB limit!)
```

---

## ✅ SOLUTION: Reduce to 3GB

We need to use **3GB** instead of 4GB to leave headroom for:
- WebAssembly modules (undici)
- System overhead
- Other process memory

### Changes Applied

1. **start.sh**: Changed to `--max-old-space-size=3072` (3GB)
2. **package.json**: Updated production script to 3GB
3. **server.js**: Warning threshold adjusted to 2.5GB

---

## 📋 What You Need to Do

### Step 1: Update start.sh on Server

**In cPanel File Manager, edit `start.sh`:**

Change this line:
```bash
exec node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js"
```

To:
```bash
exec node --max-old-space-size=3072 --expose-gc "$SCRIPT_DIR/server.js"
```

Also update the export:
```bash
export NODE_OPTIONS="--max-old-space-size=3072 --expose-gc"
```

### Step 2: Update Environment Variable

In cPanel Node.js App → Environment Variables:
- Find `NODE_OPTIONS`
- Change to: `--max-old-space-size=3072 --expose-gc`
- Save

### Step 3: Restart App

- Click "Restart App"
- Wait 20 seconds
- Check logs

---

## 🔍 Verify It's Working

After restart, check logs. You should see:
```
✅ NODE_OPTIONS: --max-old-space-size=3072 --expose-gc
📋 Current max memory: 3072.00MB  ← Should show 3072MB now
✅ MongoDB connected: ...
🚀 Server running on http://0.0.0.0:3001
```

**If you still get the error:**
- Try reducing to 2.5GB (2560) or 2GB (2048)
- Or contact hosting provider to increase LVE limits

---

## 🚨 If 3GB Still Doesn't Work

### Option 1: Reduce to 2.5GB

Update `start.sh`:
```bash
exec node --max-old-space-size=2560 --expose-gc "$SCRIPT_DIR/server.js"
```

### Option 2: Reduce to 2GB

Update `start.sh`:
```bash
exec node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js"
```

### Option 3: Contact Hosting Provider

Ask them to **increase your LVE limits**:

1. **"Can you increase the 'Max resident set' LVE limit for my account?"**
2. **"My Node.js app needs more than 4GB RAM. Can you increase it to 6GB or 8GB?"**
3. **"I'm hitting CloudLinux LVE memory limits. Can you raise them?"**

**LVE Limits to Request:**
- Max resident set: 6GB or 8GB (currently 4GB)
- Max address space: 6GB or 8GB (currently 4GB)

---

## 📊 Understanding CloudLinux LVE Limits

**From your process limits:**
```
Max resident set: 4294967296 bytes = 4GB  ← This is the limit!
Max address space: 4294967296 bytes = 4GB
```

**What this means:**
- Your process can use maximum 4GB total memory
- This includes: heap + stack + WebAssembly + system overhead
- Node.js heap (3GB) + WebAssembly (~500MB) + overhead = ~3.5GB total
- This should work, but if it doesn't, reduce to 2.5GB

---

## ✅ Updated Configuration

### start.sh (3GB version)
```bash
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export NODE_OPTIONS="--max-old-space-size=3072 --expose-gc"
export NODE_ENV=production

echo "=========================================="
echo "🚀 Starting server (CloudLinux LVE aware)"
echo "=========================================="
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
echo "=========================================="

exec node --max-old-space-size=3072 --expose-gc "$SCRIPT_DIR/server.js"
```

### Environment Variable
```
NODE_OPTIONS=--max-old-space-size=3072 --expose-gc
```

---

## 🎯 Expected Result

After updating to 3GB:
- Memory limit: 3072MB (leaves ~1GB headroom under 4GB LVE limit)
- WebAssembly should have room to allocate
- No more "Out of memory" errors

---

## 📋 Quick Checklist

- [ ] Updated start.sh to use 3072 (3GB)
- [ ] Updated NODE_OPTIONS environment variable to 3072
- [ ] Restarted app
- [ ] Logs show: `📋 Current max memory: 3072.00MB`
- [ ] No more memory errors

---

**The issue is CloudLinux LVE 4GB limit. Using 3GB leaves room for WebAssembly!**

