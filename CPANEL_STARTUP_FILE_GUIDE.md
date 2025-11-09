# How to Set Startup File in cPanel - Step-by-Step Guide

## 📍 Where to Find Startup File Setting

### Step 1: Log into cPanel

1. Go to your cPanel login page (usually `your-domain.com/cpanel` or provided by your host)
2. Enter your username and password
3. Click "Log in"

---

### Step 2: Find Node.js App

Once logged into cPanel, look for one of these:

**Option A: "Node.js App"**
- Look in the main cPanel dashboard
- Search for "Node.js" in the search bar (top right)
- Click on "Node.js App" or "Node.js Selector"

**Option B: "Node.js Selector"**
- Some cPanel versions call it "Node.js Selector"
- Look in "Software" section or main dashboard

**Option C: "Setup Node.js App"**
- Some hosts use this name
- Usually in "Software" or "Development Tools" section

**If you can't find it:**
- Use the search bar in cPanel (top right)
- Type "node" and it should appear
- Or contact your hosting provider to enable Node.js support

---

### Step 3: Access Your Application

After clicking "Node.js App" or "Node.js Selector", you'll see:

**If you already have an app:**
- You'll see a list of your Node.js applications
- Find your backend app in the list
- Click "Manage" or "Edit" button next to it

**If you don't have an app yet:**
- Click "Create Application" or "Add Application" button
- Fill in the basic details first

---

### Step 4: Find "Startup File" Setting

Once you're in the app management/edit screen, look for:

**Common Names for This Setting:**
- "Startup File" ⭐ (most common)
- "Application Startup File"
- "Entry Point"
- "Main File"
- "Startup Script"

**Where to Look:**
- Usually in the main form/configuration area
- May be in a "Settings" or "Configuration" section
- Scroll down if you don't see it immediately

**Visual Clues:**
- It's usually a text input field
- May have a label like "Startup File:" or "Entry Point:"
- Might show current value like `server.js` or `app.js`

---

### Step 5: Change Startup File to `start.sh`

1. **Find the "Startup File" field**
2. **Clear the current value** (if it says `server.js` or `app.js`)
3. **Type exactly:** `start.sh`
   - ⚠️ Must be lowercase
   - ⚠️ Must include the `.sh` extension
   - ⚠️ No spaces or extra characters
4. **Save the changes:**
   - Click "Save" button
   - Or "Update" button
   - Or "Apply" button

---

### Step 6: Add Environment Variable (Same Screen)

While you're on the same page, also add the environment variable:

1. **Find "Environment Variables" section**
   - Usually below the Startup File field
   - Or in a separate tab/section

2. **Click "Add Variable" or "+" button**

3. **Add this variable:**
   - **Name:** `NODE_OPTIONS`
   - **Value:** `--max-old-space-size=4096 --expose-gc`
   - Click "Add" or "Save"

4. **Also add other required variables** (if not already added):
   - `NODE_ENV` = `production`
   - `MONGO_URL` = `mongodb+srv://...`
   - `MONGO_PASSWORD` = `your_password`
   - `JWT_SECRET` = `your_secret`
   - etc. (see full list in CPANEL_CHECKLIST.md)

---

### Step 7: Save All Changes

1. **Scroll to bottom of page** (if needed)
2. **Click "Save" or "Update" or "Apply"**
3. **Wait for confirmation message**

---

### Step 8: Restart Your App

After saving:

1. **Look for "Restart App" button**
   - Usually on the same page
   - Or in the app list view
   - May be called "Reload" or "Restart"

2. **Click "Restart App"**
3. **Wait 15-20 seconds**
4. **Check status** - should show "Running"

---

## 📸 Visual Guide (What You Should See)

### In Node.js App List:
```
┌─────────────────────────────────────┐
│ Node.js Applications                │
├─────────────────────────────────────┤
│ Your App Name                       │
│ Status: Running                     │
│ [Manage] [Restart] [Delete]         │
└─────────────────────────────────────┘
```

### In App Management/Edit Screen:
```
┌─────────────────────────────────────┐
│ Application Settings                │
├─────────────────────────────────────┤
│ Application Root:                   │
│ /home/user/public_html/app/backend  │
│                                     │
│ Startup File: [start.sh        ]   │ ← CHANGE THIS
│                                     │
│ Node.js Version: [v18 LTS      ]    │
│                                     │
│ Environment Variables:              │
│ NODE_OPTIONS = --max-old-space...   │ ← ADD THIS
│ NODE_ENV = production               │
│ ...                                 │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

---

## 🔍 Can't Find It? Alternative Locations

### If "Startup File" is not visible:

1. **Check for Tabs/Sections:**
   - Look for tabs like "Settings", "Configuration", "Advanced"
   - Click through tabs to find it

2. **Check for Expandable Sections:**
   - Look for "▶ Advanced Settings" or similar
   - Click to expand

3. **Check Application Root Field:**
   - Sometimes it's near the "Application Root" field
   - Or in the same section

4. **Contact Hosting Provider:**
   - Ask: "Where do I set the Node.js startup file in cPanel?"
   - They may have a custom interface

---

## ✅ Verification Checklist

After setting Startup File:

- [ ] Startup File field shows: `start.sh`
- [ ] `NODE_OPTIONS` environment variable is added
- [ ] All changes are saved
- [ ] App has been restarted
- [ ] Logs show: `📋 Current max memory: 4096.00MB`

---

## 🚨 Common Issues

### Issue 1: Field is Read-Only
**Solution:** You may need to delete and recreate the app, or contact hosting provider

### Issue 2: Can't Find Node.js App Section
**Solution:** 
- Your hosting may not support Node.js
- Contact provider to enable Node.js support
- Or use a different hosting solution

### Issue 3: Changes Don't Save
**Solution:**
- Check for error messages
- Try refreshing the page
- Clear browser cache
- Try a different browser

---

## 📞 Still Can't Find It?

1. **Take a Screenshot** of your cPanel Node.js App page
2. **Contact Your Hosting Provider** with:
   - "I need to set the Node.js startup file to `start.sh`. Where is this setting in cPanel?"
   - Attach screenshot if possible

3. **Alternative:** Ask them to set it for you:
   - "Can you set the startup file to `start.sh` for my Node.js app?"
   - Provide your app name/ID

---

## 🎯 Quick Summary

1. **cPanel → Node.js App** (or "Node.js Selector")
2. **Click "Manage"** on your app
3. **Find "Startup File"** field
4. **Change to:** `start.sh`
5. **Add Environment Variable:** `NODE_OPTIONS=--max-old-space-size=4096 --expose-gc`
6. **Save**
7. **Restart App**

---

**The Startup File setting is in the Node.js App management/edit screen, usually near the top of the form.**

