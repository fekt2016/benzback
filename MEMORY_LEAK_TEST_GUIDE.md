# Memory Leak Test Guide

## Quick Start

### Option 1: Run Memory Leak Test Script (Recommended)

This script simulates production conditions and monitors memory over time:

```bash
cd backend
NODE_ENV=production node --max-old-space-size=8192 --expose-gc test-memory-leak.js
```

**What it does:**
- Monitors memory usage every minute for 30 minutes
- Detects memory leaks by tracking growth patterns
- Generates a comprehensive report at the end
- Tests database connection (if available)
- Simulates common operations

**Expected Output:**
- Initial memory snapshot
- Memory status every minute
- Leak detection warnings (if any)
- Final analysis report

---

### Option 2: Run Production Server with Monitoring

Start the production server and watch memory logs:

```bash
cd backend
npm run start:prod
```

**What to watch for:**
- Memory logs appear every minute (in production mode)
- Look for warnings: `⚠️ High memory usage`
- Check if memory grows consistently over time
- Monitor RSS (Resident Set Size) - should be stable

**Example of healthy memory logs:**
```
💾 Memory: Heap 150.23MB / 200.45MB, RSS: 180.50MB
💾 Memory: Heap 152.10MB / 200.45MB, RSS: 181.20MB
💾 Memory: Heap 151.80MB / 200.45MB, RSS: 180.90MB
```

**Example of memory leak (BAD):**
```
💾 Memory: Heap 150.23MB / 200.45MB, RSS: 180.50MB
💾 Memory: Heap 200.45MB / 250.60MB, RSS: 230.80MB
💾 Memory: Heap 280.90MB / 350.20MB, RSS: 320.10MB
⚠️  High memory usage: Heap 350.20MB / 400.50MB, RSS: 380.30MB
```

---

## Understanding Memory Metrics

### Heap Used
- Memory actively used by JavaScript objects
- Should remain relatively stable
- **Leak indicator**: Consistent growth over time

### Heap Total
- Total heap memory allocated by V8
- Can grow as needed (up to max-old-space-size)
- **Leak indicator**: Grows faster than heap used

### RSS (Resident Set Size)
- Total memory used by the process (including C++ objects, buffers)
- Most accurate measure of actual memory usage
- **Leak indicator**: Consistent growth without corresponding heap growth

### External
- Memory used by C++ objects bound to JavaScript objects
- Includes buffers, streams, database connections
- **Leak indicator**: Grows unbounded

---

## Interpreting Results

### ✅ No Leak (Healthy)
```
Average growth per minute: 0.5 MB
Total growth over 30 min: 15 MB
```
- Memory grows slowly or remains stable
- Growth is due to normal operations (caching, connections)
- GC runs successfully and frees memory

### 🟡 Minor Issue (Monitor)
```
Average growth per minute: 5 MB
Total growth over 30 min: 150 MB
```
- Memory grows but at acceptable rate
- May be due to connection pooling or caching
- Monitor in production to see if it stabilizes

### 🔴 Memory Leak (Critical)
```
Average growth per minute: 20 MB
Total growth over 30 min: 600 MB
```
- Memory grows consistently without stabilization
- GC cannot free the memory
- **Action Required**: Review code for leaks

---

## Common Leak Patterns to Check

### 1. Timers Not Cleared
```javascript
// BAD - Leak
setInterval(() => {
  // Do something
}, 1000);

// GOOD - Fixed
const interval = setInterval(() => {
  // Do something
}, 1000);
// Later: clearInterval(interval);
```

### 2. Event Listeners Not Removed
```javascript
// BAD - Leak
socket.on('event', handler);

// GOOD - Fixed
socket.on('event', handler);
// Later: socket.off('event', handler);
```

### 3. Unbounded Arrays
```javascript
// BAD - Leak
const logs = [];
app.use((req, res, next) => {
  logs.push({ time: Date.now(), path: req.path }); // Never cleared!
  next();
});

// GOOD - Fixed
const logs = [];
app.use((req, res, next) => {
  logs.push({ time: Date.now(), path: req.path });
  if (logs.length > 1000) logs.shift(); // Keep bounded
  next();
});
```

### 4. Database Connections Not Closed
```javascript
// BAD - Leak
const session = await mongoose.startSession();
// Forgot to close!

// GOOD - Fixed
const session = await mongoose.startSession();
try {
  // Use session
} finally {
  session.endSession();
}
```

---

## Production Monitoring

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "benz-backend" --node-args="--max-old-space-size=8192 --expose-gc" --env production

# Monitor memory
pm2 monit

# Check memory stats
pm2 show benz-backend
```

### Manual Monitoring

```bash
# Watch memory in real-time
watch -n 1 'ps aux | grep node | grep -v grep'

# Or use htop
htop
```

### Log Analysis

Check production logs for memory warnings:
```bash
# If using PM2
pm2 logs benz-backend | grep "Memory\|High memory\|GC"

# If using systemd
journalctl -u benz-backend -f | grep "Memory\|High memory\|GC"
```

---

## Fixes Already Applied

✅ **setInterval leak** - Fixed in `server.js` (stored and cleared on shutdown)
✅ **setTimeout leak** - Fixed in `bookingController.js` (replaced with setImmediate)
✅ **Unbounded queries** - Fixed with pagination in all list endpoints
✅ **Missing .lean()** - Added to all read-only queries
✅ **Graceful shutdown** - All timers properly cleaned up

---

## Next Steps

1. **Run the test script** to verify no leaks:
   ```bash
   NODE_ENV=production node --max-old-space-size=8192 --expose-gc test-memory-leak.js
   ```

2. **Monitor in production** for 24-48 hours:
   - Check memory logs every hour
   - Look for consistent growth patterns
   - Verify memory stabilizes after initial warm-up

3. **Set up alerts** (if using PM2 or monitoring tools):
   - Alert if memory exceeds 2GB
   - Alert if memory grows > 100MB/hour
   - Alert if GC runs too frequently

4. **Review the analysis report** (`MEMORY_LEAK_ANALYSIS.md`) for detailed findings

---

## Troubleshooting

### Test script fails to connect to MongoDB
- **Solution**: This is OK - the script will still test memory patterns
- The database connection test is optional

### Memory grows during first few minutes
- **Normal**: Application warm-up, connection pooling, caching
- **Action**: Monitor for 10+ minutes to see if it stabilizes

### GC runs frequently
- **Normal**: Node.js automatically runs GC when needed
- **Concern**: If GC runs every few seconds, memory pressure is high
- **Action**: Check for leaks or increase `--max-old-space-size`

### Memory test shows leak but production doesn't
- **Possible**: Test script simulates operations differently
- **Action**: Monitor actual production server for 24+ hours

---

**Last Updated**: After memory leak fixes
**Status**: ✅ All known leaks fixed, ready for testing

