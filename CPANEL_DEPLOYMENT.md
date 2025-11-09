# cPanel Deployment Guide - Memory Error Fix

## Problem
The production code works locally but fails on cPanel with:
```
RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance
```

## cPanel-Specific Issues

cPanel hosting often has:
1. **Stricter memory limits** (often 512MB-2GB default)
2. **Different Node.js versions** (may not support all flags)
3. **Resource limits** enforced by the hosting provider
4. **No direct access** to modify Node.js startup flags

## Solutions for cPanel

### Solution 1: Set Memory Limit via Environment Variable (Recommended)

cPanel may not respect `--max-old-space-size` in package.json scripts. Instead, set it via environment variable:

1. **In cPanel Node.js App Settings:**
   - Go to Node.js App in cPanel
   - Find "Node.js version" section
   - Add to "Node.js version" or "Startup File":
     ```
     NODE_OPTIONS=--max-old-space-size=4096
     ```

2. **Or create/update `.htaccess` in your app root:**
   ```apache
   SetEnv NODE_OPTIONS "--max-old-space-size=4096"
   ```

3. **Or in your cPanel Node.js app environment variables:**
   - Add environment variable:
     - Name: `NODE_OPTIONS`
     - Value: `--max-old-space-size=4096`

### Solution 2: Modify server.js to Read Memory Limit from Env

Update `server.js` to use environment variable for memory settings:

```javascript
// At the top of server.js, before any imports
if (process.env.NODE_OPTIONS) {
  console.log(`Node options: ${process.env.NODE_OPTIONS}`);
}
```

### Solution 3: Use PM2 on cPanel (If Available)

If your cPanel supports PM2:

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Create `ecosystem.config.js`:**
   ```javascript
   module.exports = {
     apps: [{
       name: 'benz-backend',
       script: 'server.js',
       instances: 1,
       exec_mode: 'fork',
       env: {
         NODE_ENV: 'production',
         NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc'
       },
       max_memory_restart: '3G',
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       autorestart: true
     }]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```

### Solution 4: Reduce Memory Usage (If Limits Can't Be Increased)

If cPanel won't allow higher memory limits, optimize the code:

1. **Switch Multer to Disk Storage** (reduces RAM usage):
   ```javascript
   // In bookingUpload.js and avatarUploadMiddleware.js
   const multerStorage = multer.diskStorage({
     destination: (req, file, cb) => {
       cb(null, '/tmp/uploads'); // Use temp directory
     },
     filename: (req, file, cb) => {
       cb(null, `${Date.now()}-${file.originalname}`);
     }
   });
   ```

2. **Reduce MongoDB Connection Pool:**
   ```javascript
   // In server.js
   maxPoolSize: 5, // Reduce from 10 to 5
   ```

3. **Disable Memory Monitoring** (saves a bit of memory):
   ```javascript
   // Comment out memory monitoring in server.js
   // if (process.env.NODE_ENV === "production") { ... }
   ```

### Solution 5: Check cPanel Resource Limits

1. **Check PHP/Node.js Memory Limits:**
   - In cPanel, go to "Select PHP Version" or "Node.js App"
   - Check memory_limit settings
   - Request increase from hosting provider if needed

2. **Check Server Resources:**
   - Contact hosting provider about:
     - Available RAM for Node.js processes
     - Maximum memory limit per process
     - Node.js version compatibility

### Solution 6: Use Node.js Version Manager in cPanel

Some cPanel setups allow selecting Node.js version:

1. **Select Node.js Version:**
   - Use Node.js 18.x or 20.x LTS (better memory management)
   - Avoid Node.js 22.x if it's causing issues

2. **Set in cPanel Node.js App:**
   - Choose stable LTS version
   - Ensure version supports `--max-old-space-size` flag

## Quick Fix Steps for cPanel

### Step 1: Set Environment Variable
1. Log into cPanel
2. Find "Node.js App" or "Node.js Selector"
3. Select your app
4. Add environment variable:
   - **Name**: `NODE_OPTIONS`
   - **Value**: `--max-old-space-size=4096`
5. Save and restart the app

### Step 2: Verify Node.js Version
1. In cPanel Node.js App, check Node.js version
2. Use Node.js 18.x or 20.x LTS (recommended)
3. Avoid Node.js 22.x if having issues

### Step 3: Check Startup File
1. Ensure startup file is `server.js` (not `app.js`)
2. Verify the file path is correct

### Step 4: Check Logs
1. In cPanel, check error logs
2. Look for memory-related errors
3. Check Node.js app logs

### Step 5: Contact Hosting Provider
If issues persist, contact your hosting provider and ask:
- What is the maximum memory limit for Node.js processes?
- Can they increase the memory limit for your account?
- What Node.js versions are supported?
- Are there any resource restrictions?

## Alternative: Use Different Hosting

If cPanel limitations are too restrictive, consider:
- **VPS/Dedicated Server**: Full control over resources
- **Cloud Platforms**: Heroku, Railway, Render, DigitalOcean
- **Node.js Hosting**: NodeChef, Fly.io, AWS Elastic Beanstalk

## Testing After Fix

1. **Check Memory Usage:**
   ```bash
   # In cPanel terminal or SSH
   ps aux | grep node
   # Look for memory usage
   ```

2. **Monitor Logs:**
   - Watch for memory warnings
   - Check if errors persist

3. **Test Application:**
   - Make API requests
   - Upload files
   - Monitor for crashes

## Environment Variables to Set in cPanel

Add these in your cPanel Node.js App settings:

```
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=4096
PORT=3001
```

## Important Notes

- **cPanel Memory Limits**: Often 512MB-2GB by default
- **Shared Hosting**: May have stricter limits than VPS
- **Node.js Version**: Some versions handle memory better
- **File Uploads**: Using memory storage (multer.memoryStorage()) uses more RAM

---

**Next Steps**: 
1. Set `NODE_OPTIONS` environment variable in cPanel
2. Verify Node.js version (use LTS)
3. If still failing, switch multer to disk storage
4. Contact hosting provider if limits can't be increased

