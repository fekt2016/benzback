# Memory Leak Test - How to Run & Interpret Results

## Quick Test (2 minutes)

Run this command to quickly test for memory leaks:

```bash
cd backend
NODE_ENV=production node --max-old-space-size=8192 --expose-gc quick-memory-test.js
```

**What to expect:**
- Initial memory snapshot
- Memory status every 60 seconds
- Final report after 2 minutes

---

## Full Test (5 minutes)

For a more comprehensive test:

```bash
cd backend
NODE_ENV=production node --max-old-space-size=8192 --expose-gc test-memory-leak.js
```

**Note:** The test script is currently set to run for 5 minutes. To run for 30 minutes, edit `test-memory-leak.js` and change:
```javascript
const MAX_INTERVALS = 30; // Change from 5 to 30
```

---

## Understanding the Output

### ✅ Healthy Memory (No Leak)

```
📊 MEMORY LEAK TEST RESULTS
==================================================
Duration: 2.00 minutes

Memory Growth:
   Heap: 45.23 MB → 46.10 MB (+0.87 MB)
   RSS: 120.50 MB → 121.20 MB (+0.70 MB)

Average Growth Rate:
   Heap: +0.44 MB/min
   RSS: +0.35 MB/min

🔍 Verdict:
   ✅ NO LEAK DETECTED
   🎉 Memory is stable!
```

**Interpretation:**
- Memory grows slowly (< 1 MB/min)
- Growth is normal (caching, connections)
- No leak detected ✅

---

### 🟡 Minor Issue (Monitor)

```
Average Growth Rate:
   Heap: +6.50 MB/min
   RSS: +7.20 MB/min

🔍 Verdict:
   🟡 POTENTIAL ISSUE
   💡 Monitor in production - growth is higher than expected
```

**Interpretation:**
- Memory grows moderately (5-10 MB/min)
- Could be normal for your app (connection pooling, caching)
- **Action:** Monitor in production for 24+ hours
- If growth continues, investigate further

---

### 🔴 Memory Leak (Critical)

```
Average Growth Rate:
   Heap: +25.30 MB/min
   RSS: +28.50 MB/min

🔍 Verdict:
   🔴 MEMORY LEAK DETECTED!
   ⚠️  Memory growing too fast - review code for leaks
```

**Interpretation:**
- Memory grows rapidly (> 10 MB/min)
- Indicates a memory leak
- **Action Required:** Review code immediately

---

## What the Test Checks

### 1. **Timer Leaks** ✅ FIXED
- `setInterval` in `server.js` - Now properly stored and cleared
- `setTimeout` in `bookingController.js` - Replaced with `setImmediate`

### 2. **Database Query Leaks** ✅ FIXED
- All list endpoints now use pagination
- All read-only queries use `.lean()`
- Prevents loading entire collections into memory

### 3. **Event Listener Leaks** ✅ VERIFIED
- Socket.io disconnect handlers properly clean up
- `onlineUsers` Map is cleared on disconnect

### 4. **Unbounded Arrays** ✅ FIXED
- All endpoints have pagination limits
- Maximum 100 items per page

---

## Expected Results After Fixes

Based on the fixes applied, you should see:

### ✅ Expected (Good)
- **Initial Memory:** 40-80 MB heap, 100-200 MB RSS
- **Growth Rate:** < 2 MB/min
- **After 5 minutes:** +5-10 MB total growth
- **Verdict:** ✅ NO LEAK DETECTED

### Why Some Growth is Normal

1. **Connection Pooling:** MongoDB connections (up to 10)
2. **Caching:** Express response caching
3. **Socket.io:** Active connections
4. **Garbage Collection:** GC runs periodically, may show temporary spikes

---

## Running in Production

### Option 1: Monitor Production Logs

Start production server:
```bash
npm run start:prod
```

Watch for memory logs (every minute):
```
💾 Memory: Heap 150.23MB / 200.45MB, RSS: 180.50MB
💾 Memory: Heap 152.10MB / 200.45MB, RSS: 181.20MB
```

**Healthy pattern:**
- Memory fluctuates but stays within range
- No consistent upward trend
- GC runs successfully

**Leak pattern:**
- Memory grows consistently every minute
- No stabilization
- Warnings: `⚠️ High memory usage`

### Option 2: Use PM2 Monitoring

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "benz-backend" \
  --node-args="--max-old-space-size=8192 --expose-gc" \
  --env production

# Monitor memory
pm2 monit

# Check stats
pm2 show benz-backend
```

---

## Troubleshooting

### Test shows leak but production doesn't

**Possible reasons:**
1. Test script simulates different conditions
2. Production has different traffic patterns
3. Database connection affects test results

**Solution:** Monitor actual production server for 24+ hours

### Memory grows during first few minutes

**This is normal!** Reasons:
- Application warm-up
- Connection pool initialization
- JIT compilation
- Module loading

**Action:** Wait 5-10 minutes for stabilization

### GC runs frequently

**Normal:** Node.js runs GC automatically when needed

**Concern:** If GC runs every few seconds, memory pressure is high

**Action:** 
- Check for leaks
- Increase `--max-old-space-size` if needed
- Review memory-intensive operations

---

## Next Steps

1. **Run the quick test** (2 minutes):
   ```bash
   NODE_ENV=production node --max-old-space-size=8192 --expose-gc quick-memory-test.js
   ```

2. **Review the results:**
   - If ✅ NO LEAK: Proceed to production
   - If 🟡 POTENTIAL ISSUE: Monitor in production
   - If 🔴 LEAK DETECTED: Review code immediately

3. **Monitor in production** for 24-48 hours:
   - Check memory logs every hour
   - Look for consistent growth patterns
   - Verify memory stabilizes after warm-up

4. **Set up alerts** (if using PM2 or monitoring tools):
   - Alert if memory > 2GB
   - Alert if growth > 100MB/hour
   - Alert if GC runs too frequently

---

## Summary of Fixes Applied

✅ **All known memory leaks have been fixed:**
- setInterval properly cleaned up
- setTimeout replaced with setImmediate
- All queries use pagination
- All read-only queries use .lean()
- Socket.io properly cleans up
- Graceful shutdown clears all timers

**Expected Result:** ✅ NO MEMORY LEAK DETECTED

---

**Last Updated:** After memory leak fixes
**Status:** Ready for testing

