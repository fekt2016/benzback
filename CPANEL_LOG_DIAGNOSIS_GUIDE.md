# 📋 cPanel Log Information Needed for Diagnosis

## 🎯 Critical Information to Collect

To diagnose the production issue, please provide the following information from your cPanel logs:

---

## 1. **Startup Logs** (Most Important)

**Location**: cPanel → Node.js App → Logs (or Terminal)

**What to look for:**
- Any error messages during server startup
- Module loading errors
- Import/require errors
- Memory limit messages

**Example of what I need:**
```
✅ NODE_OPTIONS: --max-old-space-size=2096 --expose-gc
📋 Node.js version: v20.19.4
📋 Current max memory: 2096.00MB
✅ Memory limit is correctly set: 2096.00MB (target: 2048MB)
✅ All environment variables validated successfully

[Then any errors that follow...]
```

**Copy the ENTIRE startup log** from when the server starts until it either:
- Starts successfully, OR
- Crashes with an error

---

## 2. **Error Messages** (Critical)

**What to copy:**
- The **exact error message** (word-for-word)
- The **full stack trace** (if available)
- The **timestamp** when the error occurred

**Common errors to look for:**
```
❌ Error: Cannot find module 'p-limit'
❌ TypeError: pLimit is not a function
❌ Error: Cannot find module './services/stripeClient'
❌ RangeError: WebAssembly.instantiate(): Out of memory
❌ Error: Cannot find module '../services/cloudinaryClient'
```

**Example format:**
```
Error: Cannot find module 'p-limit'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1144:15)
    at Function.Module._load (node:internal/modules/cjs/loader:988:27)
    at Module.require (node:internal/modules/cjs/loader:1231:19)
    at require (node:internal/modules/helpers:136:16)
    at Object.<anonymous> (/path/to/bookingUpload.js:6:21)
```

---

## 3. **When Does the Error Occur?**

Please specify:
- [ ] **At startup** (server won't start)
- [ ] **During API requests** (server starts but API calls fail)
- [ ] **Specific endpoint** (which endpoint fails?)
- [ ] **Randomly** (intermittent errors)

---

## 4. **Module Loading Errors**

**Look for these patterns in logs:**
```
Cannot find module '...'
Module not found: ...
Error: Cannot resolve module '...'
```

**Check for:**
- `p-limit` import errors
- `services/stripeClient` errors
- `services/cloudinaryClient` errors
- `services/sendGridClient` errors
- `middleware/bookingUpload` errors

---

## 5. **Memory-Related Errors**

**Look for:**
```
RangeError: WebAssembly.instantiate(): Out of memory
RangeError: Maximum call stack size exceeded
FATAL ERROR: Reached heap limit
```

**Also check:**
- Memory usage statistics (if available)
- When memory errors occur (startup vs runtime)

---

## 6. **API Request Errors**

**If errors occur during API calls:**
- Which endpoint fails? (e.g., `/api/v1/bookings`, `/api/v1/payment`)
- What's the HTTP status code? (500, 404, etc.)
- What's the error message in the response?

---

## 7. **File Structure Verification**

**In cPanel Terminal, run:**
```bash
cd public_html/myapp/backend  # or your backend path
ls -la services/
ls -la middleware/
ls -la controllers/
```

**Check if these files exist:**
- `services/stripeClient.js`
- `services/cloudinaryClient.js`
- `services/sendGridClient.js`
- `middleware/bookingUpload.js`
- `package.json` (and verify `p-limit` is listed)

---

## 8. **Package Installation Status**

**In cPanel Terminal, run:**
```bash
cd public_html/myapp/backend
npm list p-limit
```

**Check if:**
- `p-limit` is installed
- Version matches (should be 7.2.0)

---

## 9. **Environment Variables**

**Check if these are set in cPanel Node.js App:**
- `STRIPE_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SENDGRID_API_KEY`
- `NODE_OPTIONS` (should be `--max-old-space-size=2048 --expose-gc`)
- `DEBUG_KEY`

**Note**: Don't share the actual values, just confirm they're set.

---

## 10. **Complete Error Context**

**For each error, provide:**
1. **Error message** (exact text)
2. **Stack trace** (full trace)
3. **When it occurs** (startup, specific API call, etc.)
4. **Frequency** (always, sometimes, random)
5. **What you were doing** (which API endpoint, what action)

---

## 📝 Quick Checklist

Copy this checklist and fill it out:

```
[ ] Startup logs (entire log from server start)
[ ] Error messages (exact text)
[ ] Stack traces (full trace)
[ ] When error occurs (startup/runtime/specific endpoint)
[ ] Module loading errors (which modules?)
[ ] Memory errors (if any)
[ ] File structure verification (ls -la commands)
[ ] Package installation (npm list p-limit)
[ ] Environment variables (which ones are set)
[ ] API request errors (which endpoints fail)
```

---

## 🎯 Most Critical Information

**Priority 1 (Most Important):**
1. **Full startup log** - From server start to error/crash
2. **Exact error message** - Word-for-word copy
3. **Stack trace** - Complete trace showing file and line number

**Priority 2 (Very Helpful):**
4. **When error occurs** - Startup vs runtime
5. **Module loading errors** - Which modules can't be found
6. **File structure** - Output of `ls -la` commands

**Priority 3 (Additional Context):**
7. **Environment variables** - Which ones are set (not values)
8. **Package status** - Output of `npm list p-limit`
9. **API errors** - Which endpoints fail

---

## 💡 How to Get Logs from cPanel

### Method 1: Node.js App Logs
1. Go to cPanel → **Node.js App**
2. Click on your app
3. Click **"Logs"** or **"View Logs"**
4. Copy the entire log output

### Method 2: Terminal
1. Go to cPanel → **Terminal**
2. Navigate to your app directory:
   ```bash
   cd public_html/myapp/backend
   ```
3. Check logs:
   ```bash
   tail -n 100 ~/logs/nodejs.log
   # or
   cat ~/logs/nodejs.log
   ```

### Method 3: Application Logs
1. Check if there's a `logs/` directory in your app
2. View recent logs:
   ```bash
   tail -f logs/app.log
   ```

---

## 🔍 What I'll Do With This Information

Once I have the logs, I will:
1. **Identify the root cause** - What's actually failing
2. **Check module paths** - Verify file locations
3. **Verify imports** - Check require() statements
4. **Fix the issue** - Provide the exact fix needed
5. **Test the fix** - Ensure it works before you deploy

---

## 📧 Format for Sharing

When sharing logs, please format like this:

```
=== STARTUP LOG ===
[Paste full startup log here]

=== ERROR MESSAGE ===
[Paste exact error message here]

=== STACK TRACE ===
[Paste full stack trace here]

=== WHEN IT OCCURS ===
[Startup / Runtime / Specific endpoint]

=== FILE STRUCTURE ===
[Output of ls -la commands]

=== PACKAGE STATUS ===
[Output of npm list p-limit]
```

---

*This information will help me quickly identify and fix the issue!*

