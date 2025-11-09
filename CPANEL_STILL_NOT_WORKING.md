# 🔴 cPanel Still Showing Memory Error - Advanced Fix

## The Problem

Even with `start.sh` set as startup file, you're still getting:
```
RangeError: WebAssembly.instantiate(): Out of memory
```

**This means cPanel is STILL not applying the memory flags!**

---

## ✅ SOLUTION 1: Reduce Memory to 2GB

Your server might not have 4GB available. Let's try 2GB first:

### Step 1: Update start.sh on Server

**In cPanel File Manager, edit `start.sh` and change:**

**FROM:**
```bash
exec node --max-old-space-size=4096 --expose-gc server.js
```

**TO:**
```bash
exec node --max-old-space-size=2048 --expose-gc server.js
```

**Also update the export:**
```bash
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"
```

### Step 2: Update Environment Variable

In cPanel Node.js App:
- Find `NODE_OPTIONS` environment variable
- Change value to: `--max-old-space-size=2048 --expose-gc`
- Save

### Step 3: Restart App

- Click "Restart App"
- Check logs

---

## ✅ SOLUTION 2: Verify start.sh is Actually Running

### Check Logs for These Messages

**If start.sh is running, you should see:**
```
==========================================
🚀 Starting server with memory settings
==========================================
📋 NODE_OPTIONS: --max-old-space-size=2048 --expose-gc
```

**If you DON'T see these messages:**
- start.sh is NOT being executed
- cPanel is ignoring the startup file
- Try Solution 3 below

---

## ✅ SOLUTION 3: Use Absolute Paths

Some cPanel setups need absolute paths. Update `start.sh`:

```bash
#!/bin/bash
# Get absolute path to script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"
export NODE_ENV=production

echo "=========================================="
echo "🚀 Starting server"
echo "=========================================="
echo "📋 Directory: $SCRIPT_DIR"
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "=========================================="

# Use absolute path to server.js
exec node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js"
```

---

## ✅ SOLUTION 4: Try Even Lower Memory (1GB)

If 2GB still doesn't work, try 1GB:

**In start.sh:**
```bash
exec node --max-old-space-size=1024 --expose-gc server.js
```

**In cPanel environment variable:**
```
NODE_OPTIONS=--max-old-space-size=1024 --expose-gc
```

---

## ✅ SOLUTION 5: Check Server Resources

### Ask Your Hosting Provider:

1. **"What is the maximum RAM available for Node.js processes?"**
2. **"What is the current memory limit for my Node.js app?"**
3. **"Can you increase the Node.js memory limit?"**
4. **"Do you block Node.js startup flags like --max-old-space-size?"**

### Check Available Memory (If You Have SSH):

```bash
# Check total system memory
free -h

# Check current Node.js process memory
ps aux | grep node
```

---

## ✅ SOLUTION 6: Verify start.sh Permissions

**In cPanel File Manager:**
1. Right-click `start.sh`
2. Check permissions - must be `755` or `rwxr-xr-x`
3. If not, change to `755`

**Or via SSH:**
```bash
chmod +x /path/to/backend/start.sh
ls -la /path/to/backend/start.sh
# Should show: -rwxr-xr-x
```

---

## ✅ SOLUTION 7: Check Application Root Path

**In cPanel Node.js App settings:**

1. **Check "Application Root" path:**
   - Should point to your backend folder
   - Example: `/home/username/public_html/myapp/backend`
   - NOT: `/home/username/public_html/myapp`

2. **Verify start.sh is in that folder:**
   - If Application Root is `/home/username/public_html/myapp/backend`
   - Then `start.sh` must be in `/home/username/public_html/myapp/backend/`
   - Same folder as `server.js`

---

## 🔍 Diagnostic Steps

### Step 1: Check What's Actually Running

**In cPanel logs, look for:**
- Do you see the "🚀 Starting server" message from start.sh?
- What does "📋 Current max memory" show?
- Are there any error messages before the memory error?

### Step 2: Test start.sh Manually (If You Have SSH)

```bash
cd /path/to/your/backend
chmod +x start.sh
./start.sh
```

**If this works manually but not in cPanel:**
- cPanel is not using start.sh
- Check Application Root path
- Verify Startup File is exactly `start.sh`

### Step 3: Check Node.js Version

**In cPanel Node.js App:**
- What Node.js version is selected?
- Should be v16+ (preferably v18 LTS)
- Older versions may have issues

---

## 🚨 Last Resort: Contact Hosting Provider

If nothing works, your hosting provider may be blocking Node.js flags. Ask them:

1. **"Can you enable --max-old-space-size flag for Node.js?"**
2. **"What is the maximum memory limit for Node.js apps?"**
3. **"Can you manually set the memory limit for my Node.js app?"**
4. **"Do you support Node.js startup scripts in cPanel?"**

---

## 📋 Updated start.sh (2GB Version)

Here's the complete updated `start.sh` to upload:

```bash
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"
export NODE_ENV=production

echo "=========================================="
echo "🚀 Starting server with memory settings"
echo "=========================================="
echo "📋 Directory: $SCRIPT_DIR"
echo "📋 NODE_OPTIONS: $NODE_OPTIONS"
echo "📋 Node.js version: $(node --version)"
echo "=========================================="

if [ ! -f "$SCRIPT_DIR/server.js" ]; then
  echo "❌ ERROR: server.js not found"
  exit 1
fi

exec node --max-old-space-size=2048 --expose-gc "$SCRIPT_DIR/server.js"
```

---

## ✅ Quick Fix Checklist

- [ ] Updated start.sh to use 2GB (2048) instead of 4GB
- [ ] Updated NODE_OPTIONS environment variable to 2048
- [ ] Verified start.sh permissions are 755
- [ ] Verified Application Root points to backend folder
- [ ] Verified start.sh is in backend folder (same as server.js)
- [ ] Restarted app
- [ ] Checked logs for "🚀 Starting server" message
- [ ] Checked logs for memory limit (should show 2048MB)

---

**Try reducing to 2GB first - your server may not have 4GB available!**

