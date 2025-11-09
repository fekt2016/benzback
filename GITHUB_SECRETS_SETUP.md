# GitHub Secrets Setup for FTP Deployment

## 🔐 Required Secrets

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

### Required Secrets

1. **CPANEL_FTP_SERVER** (or `FTP_SERVER`)
   - **Value:** Your FTP server address
   - **Example:** `ftp.yourdomain.com` or `yourdomain.com`
   - **Note:** Can use IP address if needed

2. **CPANEL_FTP_USER** (or `FTP_USERNAME`)
   - **Value:** Your cPanel FTP username
   - **Example:** `username@yourdomain.com` or just `username`

3. **CPANEL_FTP_PASS** (or `FTP_PASSWORD`)
   - **Value:** Your cPanel FTP password
   - **Note:** Keep this secure, never commit to code

### Optional Secrets

4. **CPANEL_FTP_PORT**
   - **Value:** FTP port number
   - **Default:** `21` (if not set)
   - **Example:** `21` or `22` (for SFTP)

5. **CPANEL_FTP_DIR**
   - **Value:** Server directory path
   - **Default:** `public_html/myapp/` (if not set)
   - **Example:** `public_html/myapp/` or `/home/username/public_html/myapp/`

---

## 📋 How to Add Secrets

### Step 1: Access Secrets
1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

### Step 2: Add Each Secret

**For CPANEL_FTP_SERVER:**
- **Name:** `CPANEL_FTP_SERVER`
- **Secret:** `ftp.yourdomain.com` (your actual FTP server)
- Click **Add secret**

**For CPANEL_FTP_USER:**
- **Name:** `CPANEL_FTP_USER`
- **Secret:** `your_ftp_username`
- Click **Add secret**

**For CPANEL_FTP_PASS:**
- **Name:** `CPANEL_FTP_PASS`
- **Secret:** `your_ftp_password`
- Click **Add secret**

**For CPANEL_FTP_DIR (Optional):**
- **Name:** `CPANEL_FTP_DIR`
- **Secret:** `public_html/myapp/`
- Click **Add secret**

---

## 🔍 Finding Your FTP Credentials

### In cPanel

1. **Log into cPanel**
2. **Find "FTP Accounts"** (search for "FTP")
3. **Your FTP credentials are shown there:**
   - **Server:** Usually `ftp.yourdomain.com` or your domain
   - **Username:** Your cPanel username or FTP account username
   - **Password:** Your FTP password

### Alternative: Use cPanel Username

- **Server:** Your domain name or IP
- **Username:** Your cPanel username
- **Password:** Your cPanel password

---

## ✅ Verification

After adding secrets, the workflow will:
1. Verify secrets are set (Step 3)
2. Show secret lengths (without revealing values)
3. Fail early if secrets are missing

---

## 🔒 Security Best Practices

1. **Never commit secrets to code**
   - Use GitHub Secrets only
   - Don't put in `config.env` or code files

2. **Rotate passwords regularly**
   - Update secrets if password changes
   - Use strong, unique passwords

3. **Limit access**
   - Only give repository access to trusted team members
   - Review who has access to secrets

4. **Use different secrets for different environments**
   - Production: `CPANEL_FTP_SERVER`
   - Staging: `STAGING_FTP_SERVER`
   - Development: `DEV_FTP_SERVER`

---

## 🚨 Troubleshooting

### Error: "One or more FTP secrets are missing"
**Solution:** Add all required secrets in GitHub Settings

### Error: "FTP connection failed"
**Solution:** 
- Verify FTP server address
- Check username/password
- Verify FTP is enabled in cPanel

### Error: "552 Disk full"
**Solution:**
- Clean up server disk space
- The workflow now excludes large files automatically
- Install `node_modules` on server after deployment

---

## 📝 Secret Names (Both Supported)

The workflow supports both naming conventions:

**Option 1 (Recommended):**
- `CPANEL_FTP_SERVER`
- `CPANEL_FTP_USER`
- `CPANEL_FTP_PASS`

**Option 2 (Legacy):**
- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

The workflow will try Option 1 first, then fall back to Option 2.

---

**After adding secrets, your workflow will be ready to deploy!** 🚀

