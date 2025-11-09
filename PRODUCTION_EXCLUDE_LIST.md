# 🚫 Files to Exclude from Production Deployment

This document lists all files and directories that should **NOT** be deployed to production.

## 📋 Quick Summary

**Total files/directories to exclude: ~25+**

---

## 🗂️ Categories

### 1. **Development & Testing Files** ❌
These are development-only files that should never be in production:

```
test-memory-leak.js
monitor-memory.js
monitor-production.js
quick-memory-test.js
run-production-test.js
test-production-memory.sh
analyze-memory.sh
run-and-monitor.sh
server-wrapper.js
start-node.sh
memory-monitor-report.json
production-run.log
```

**Reason**: These are testing/monitoring scripts used only during development.

---

### 2. **Development Scripts** ❌
Scripts in the `scripts/` directory that are for development/maintenance:

```
scripts/testStripeKeys.js          # Testing script
scripts/seedProfessionalDrivers.js # Database seeding (dev only)
scripts/updateDriverTypes.js       # Migration script
scripts/updateExecutive.js         # Migration script
scripts/verifyDrivers.js           # Verification script
```

**Reason**: These are one-time setup/migration scripts, not needed in production runtime.

---

### 3. **Git & Version Control** ❌
```
.git/
.github/
.gitignore
.gitattributes
```

**Reason**: Version control files are not needed in production.

---

### 4. **Documentation Files** ❌
```
*.md (all markdown files - already deleted)
```

**Reason**: Documentation is for developers, not production servers.

---

### 5. **Log Files** ❌
```
*.log
logs/
production-run.log
memory-monitor-report.json
```

**Reason**: Logs should be generated fresh in production, not deployed.

---

### 6. **Temporary Files** ❌
```
*.tmp
tmp/
.tmp/
```

**Reason**: Temporary files should not be deployed.

---

### 7. **Environment Files** ⚠️
```
config.env          # ⚠️ DO NOT DEPLOY - Contains secrets!
.env
.env.local
.env.development
.env.test
```

**Reason**: Environment files contain sensitive secrets. Production should use cPanel environment variables instead.

---

### 8. **IDE/Editor Files** ❌
```
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
```

**Reason**: IDE-specific files are not needed in production.

---

### 9. **Node Modules** ⚠️
```
node_modules/       # ⚠️ Reinstall on server, don't deploy
```

**Reason**: 
- Too large for FTP deployment
- Should be installed fresh on server with `npm install --production`
- Ensures compatibility with server's Node.js version

---

### 10. **Build Artifacts** ❌
```
dist/
build/
coverage/
*.map
```

**Reason**: Build artifacts are generated, not deployed.

---

## ✅ Files That SHOULD Be Deployed

### Core Application Files ✅
```
server.js
app.js
start.sh                    # ⚠️ CRITICAL - Needed for memory flags
package.json
package-lock.json
```

### Source Code ✅
```
controllers/
routes/
models/
middleware/
services/
utils/
socket/
```

### Configuration ✅
```
config.env.example          # If you have one (template only, no secrets)
```

---

## 📝 Current Deployment Workflow Exclusions

Your `.github/workflows/deploy.yml` already excludes:

```yaml
exclude: |
  **/node_modules/**
  **/.git/**
  **/.github/**
  **/tmp/**
  **/logs/**
  **/*.log
  **/*.md
  **/test-*.js
  **/*.test.js
  **/*.spec.js
```

---

## 🔧 Recommended Additional Exclusions

Add these to your deployment workflow:

```yaml
exclude: |
  # Existing exclusions...
  **/scripts/**
  **/monitor-*.js
  **/quick-*.js
  **/run-*.js
  **/test-*.js
  **/analyze-*.sh
  **/*.sh                    # Except start.sh
  **/*.log
  **/*.tmp
  **/.env*
  **/config.env
  **/.vscode/**
  **/.idea/**
  **/.DS_Store
  **/memory-monitor-report.json
  **/server-wrapper.js
  **/start-node.sh
```

**But KEEP:**
- `start.sh` ✅ (CRITICAL for memory flags)

---

## 🎯 Summary by File Type

| Type | Count | Action |
|------|-------|--------|
| Test files | ~5 | ❌ Exclude |
| Monitor scripts | ~4 | ❌ Exclude |
| Development scripts | ~5 | ❌ Exclude |
| Log files | ~2 | ❌ Exclude |
| Shell scripts (dev) | ~4 | ❌ Exclude |
| Config files (secrets) | ~1 | ❌ Exclude |
| Documentation | ~36 | ❌ Already deleted |
| **Total** | **~57** | **Exclude from production** |

---

## ⚠️ Critical Files to KEEP

These files **MUST** be deployed:

1. ✅ `start.sh` - Required for memory flags in cPanel
2. ✅ `server.js` - Main server entry point
3. ✅ `app.js` - Express app configuration
4. ✅ `package.json` - Dependencies list
5. ✅ All source code directories (controllers, routes, models, etc.)

---

## 🚀 Deployment Size Impact

**Before exclusions**: ~500MB+ (with node_modules)  
**After exclusions**: ~50-100MB (source code only)

**Benefits:**
- Faster FTP uploads
- Less disk space usage
- Cleaner production environment
- Reduced security risk (no test files, no secrets)

---

*Last Updated: Production exclude list*

