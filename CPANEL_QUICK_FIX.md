# cPanel Quick Fix - Memory Error

## The Problem
Your code works locally but fails on cPanel with:
```
RangeError: WebAssembly.instantiate(): Out of memory
```

**Why?** cPanel doesn't use the `--max-old-space-size` flag from package.json scripts.

## ✅ Solution: Set Environment Variable in cPanel

### Step 1: Log into cPanel

### Step 2: Find Node.js App
- Look for "Node.js App" or "Node.js Selector" in cPanel
- Click on it

### Step 3: Select Your App
- Find your backend app in the list
- Click "Manage" or "Edit"

### Step 4: Add Environment Variable
1. Scroll to "Environment Variables" section
2. Click "Add Variable" or "+"
3. Add:
   - **Name**: `NODE_OPTIONS`
   - **Value**: `--max-old-space-size=4096`
4. Click "Save" or "Update"

### Step 5: Restart Your App
- Click "Restart App" or "Reload App"
- Wait for it to restart

### Step 6: Check Logs
- View the logs to see if it starts successfully
- You should see: `📋 NODE_OPTIONS: --max-old-space-size=4096`

## Alternative: If Environment Variables Don't Work

### Option A: Create `.node-version` file
Create a file named `.node-version` in your backend root:
```
18.20.0
```
(Use a stable LTS version)

### Option B: Use `start.sh` script
Create `start.sh` in your backend root:
```bash
#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=4096"
node server.js
```

Then in cPanel Node.js App:
- Set "Startup File" to: `start.sh`
- Make sure it's executable

### Option C: Contact Hosting Provider
Ask them to:
1. Increase memory limit for Node.js processes
2. Allow `--max-old-space-size` flag
3. Check what Node.js version is available

## Verify It's Working

After restarting, check the logs. You should see:
```
📋 Node.js version: v18.x.x
📋 Default max memory: 4096MB (or higher)
📋 NODE_OPTIONS: --max-old-space-size=4096
```

If you see a lower memory limit (like 512MB or 1024MB), the environment variable isn't being applied.

## If Still Failing

1. **Reduce memory requirement** (temporary fix):
   - Change `NODE_OPTIONS` value to: `--max-old-space-size=2048`
   - Or even: `--max-old-space-size=1024`

2. **Check server resources**:
   - Contact hosting provider about available RAM
   - Ask if they can increase limits

3. **Optimize code**:
   - Switch multer to disk storage (see CPANEL_DEPLOYMENT.md)
   - Reduce MongoDB connection pool

---

**Most Important**: Set `NODE_OPTIONS=--max-old-space-size=4096` as an environment variable in cPanel Node.js App settings!

