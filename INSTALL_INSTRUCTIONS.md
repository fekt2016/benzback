# 📦 Install Dependencies on Server

After deploying to cPanel, you need to install dependencies on the server.

## 🚀 Quick Install

### Option 1: Using the Script (Recommended)

1. **Upload the script:**
   - Upload `install-dependencies.sh` to: `~/public_html/myapp/backend/`

2. **Run the script:**
   ```bash
   cd ~/public_html/myapp/backend
   bash install-dependencies.sh
   ```

### Option 2: Direct Command

```bash
cd ~/public_html/myapp/backend
npm install --production --legacy-peer-deps
```

## 📋 What This Does

- Installs only production dependencies (no dev dependencies)
- Uses `--legacy-peer-deps` flag to avoid peer dependency conflicts
- Creates `node_modules/` directory with all required packages

## ⚠️ Important Notes

- **Disk Space:** Make sure you have enough disk space (node_modules can be large)
- **Node.js Version:** Requires Node.js 18+ (check with `node --version`)
- **Time:** Installation may take 2-5 minutes depending on server speed

## 🔍 Troubleshooting

### If installation fails:

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Clean npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Remove and reinstall:**
   ```bash
   rm -rf node_modules
   npm install --production --legacy-peer-deps
   ```

4. **Check Node.js version:**
   ```bash
   node --version
   ```
   Should be v18.0.0 or higher

## ✅ After Installation

1. Set environment variables in cPanel Node.js App
2. Set startup file to: `start.sh`
3. Restart Node.js app
4. Check logs for successful startup

