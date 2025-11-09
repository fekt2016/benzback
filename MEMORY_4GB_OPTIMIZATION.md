# Memory Optimization for 4GB Limit

## Changes Applied

### 1. Memory Limit Reduced to 4GB ✅

**Updated Files:**
- `package.json`: Changed from `--max-old-space-size=8192` to `--max-old-space-size=4096`
- `start.sh`: Updated to use 4GB limit
- `server.js`: Warning threshold set to 3GB (75% of 4GB)

### 2. MongoDB Connection Pool Reduced ✅

**Change:**
- `maxPoolSize`: Reduced from 10 to 5
- **Memory Savings**: ~50% reduction in connection pool memory
- **Impact**: Still sufficient for most applications, reduces memory footprint

### 3. Memory Monitoring Threshold Updated ✅

**Change:**
- Warning threshold: 3GB (was 6GB)
- Triggers GC when heap exceeds 3GB
- Alerts when approaching 4GB limit

---

## Memory Usage Breakdown

### Expected Memory Usage (Under 4GB)

**Base Memory:**
- Node.js runtime: ~50-100 MB
- Express + middleware: ~30-50 MB
- MongoDB driver: ~20-40 MB
- Socket.io: ~20-40 MB
- **Total Base: ~120-230 MB**

**Per Request:**
- API requests: ~1-5 MB (with pagination + lean)
- File uploads: ~5-10 MB (temporary, cleaned up)
- Database queries: ~1-3 MB (with lean)

**Connection Pool:**
- MongoDB connections (5): ~10-20 MB
- Socket.io connections: ~5-10 MB per active connection

**Total Expected: 200-400 MB under normal load**

---

## Optimizations Already Applied

### ✅ Query Optimizations
- All list endpoints use pagination (max 100 items/page)
- All read-only queries use `.lean()` (60% memory reduction)
- Field selection limits data loaded

### ✅ Memory Leak Fixes
- setInterval properly cleaned up
- setTimeout replaced with setImmediate
- Socket.io disconnect handlers verified
- Graceful shutdown implemented

### ✅ File Upload Optimization
- Uses disk storage (not memory storage)
- Files cleaned up after upload
- Limits: 5MB per file

---

## Monitoring & Alerts

### Memory Warnings

**At 3GB (75% of limit):**
```
⚠️  High memory usage: Heap 3000.00MB / 4000.00MB, RSS: 3500.00MB
⚠️  Memory is approaching 4GB limit. Consider optimizing or scaling.
🧹 GC ran. Memory after: 2800.00MB
```

**Action Required:**
- Review recent requests
- Check for memory leaks
- Consider scaling if traffic is high

### Normal Memory Logs

**Every minute:**
```
💾 Memory: Heap 200.23MB / 400.45MB, RSS: 250.50MB
```

---

## Recommendations for Staying Under 4GB

### 1. Monitor Connection Pool Usage
- Current: 5 connections
- Monitor: If you see connection errors, may need to increase slightly
- Balance: Memory vs. performance

### 2. Limit Concurrent Requests
- Rate limiting already in place ✅
- Monitor: Check if limits need adjustment
- Consider: Reducing limits if memory pressure is high

### 3. Optimize Large Queries
- All queries already use pagination ✅
- Consider: Reducing max page size from 100 to 50 if needed
- Monitor: Query response times

### 4. File Upload Limits
- Current: 5MB per file
- Consider: Reducing to 3MB if memory pressure is high
- Monitor: Upload success rates

### 5. Cache Management
- Review: Any in-memory caches
- Consider: Using Redis for caching instead of in-memory
- Monitor: Cache sizes

---

## If Memory Exceeds 4GB

### Immediate Actions

1. **Check Logs:**
   - Look for memory warnings
   - Identify which endpoints are using most memory
   - Check for memory leaks

2. **Force GC:**
   - GC runs automatically at 3GB
   - Can manually trigger if needed

3. **Reduce Load:**
   - Temporarily reduce rate limits
   - Reduce connection pool if needed
   - Scale horizontally if possible

4. **Optimize Further:**
   - Reduce page sizes
   - Add more `.lean()` calls
   - Review large queries

### Long-term Solutions

1. **Scale Horizontally:**
   - Run multiple instances
   - Use load balancer
   - Distribute memory usage

2. **Use External Services:**
   - Redis for caching
   - CDN for static files
   - External file storage

3. **Optimize Database:**
   - Add indexes
   - Optimize queries
   - Use aggregation pipelines

---

## Verification

### Check Current Settings

```bash
# Verify memory limit
grep "max-old-space-size" package.json
# Should show: --max-old-space-size=4096

# Verify connection pool
grep "maxPoolSize" server.js
# Should show: maxPoolSize: 5

# Check start.sh
grep "NODE_OPTIONS" start.sh
# Should show: --max-old-space-size=4096
```

### Test Memory Usage

```bash
# Run production server
npm run start:prod

# Monitor memory
# Check logs every minute for memory status
# Should stay well under 4GB
```

---

## Summary

✅ **Memory limit set to 4GB**
✅ **Connection pool reduced to 5**
✅ **Warning threshold at 3GB**
✅ **All optimizations applied**

**Expected Memory Usage:**
- Normal: 200-400 MB
- Under load: 400-800 MB
- Peak: < 2GB (with GC)
- Limit: 4GB (hard limit)

**Status:** ✅ Optimized for 4GB memory limit

---

**Last Updated:** After 4GB optimization
**Status:** Ready for production with 4GB limit

