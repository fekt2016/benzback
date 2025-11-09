# Memory Issue Fix - WebAssembly Out of Memory

## Problem
```
RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance
```

This error occurs when Node.js runs out of memory, particularly when trying to instantiate WebAssembly modules (used by `undici` HTTP client).

## Solutions Applied

### 1. **Increased Memory Limit** ✅
- **Before**: `--max-old-space-size=4096` (4GB)
- **After**: `--max-old-space-size=8192` (8GB)
- **Location**: `package.json` line 8
- **Why**: Production servers handling multiple concurrent requests need more memory

### 2. **Enabled Garbage Collection** ✅
- Added `--expose-gc` flag to allow manual garbage collection
- **Location**: `package.json` line 8
- **Why**: Allows programmatic memory cleanup when needed

### 3. **Memory Monitoring** ✅
- Added production memory monitoring
- Logs memory usage every minute
- Warns when memory exceeds 6GB threshold
- Automatically triggers GC if available
- **Location**: `server.js` lines 66-88

## Additional Recommendations

### For Production Server

1. **Check Server Resources**:
   ```bash
   # Check available memory
   free -h
   # or
   df -h
   ```

2. **Monitor Memory Usage**:
   - Watch the memory logs in production
   - Set up alerts if memory consistently exceeds 7GB

3. **Consider Process Manager**:
   - Use PM2 with memory limits and auto-restart
   - PM2 will automatically restart if memory exceeds limits

4. **Optimize File Uploads** (if using memory storage):
   - Consider switching multer to disk storage for large files
   - Current: `multer.memoryStorage()` - stores files in RAM
   - Alternative: `multer.diskStorage()` - stores files on disk

5. **Database Query Optimization**:
   - Already using `.lean()` in webhookController ✅
   - Continue using `.select()` to limit fields
   - Avoid loading large documents unnecessarily

6. **Connection Pooling**:
   - Current: `maxPoolSize: 10` ✅
   - Monitor and adjust based on traffic

## PM2 Configuration (Recommended)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'benz-backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    max_memory_restart: '7G',
    node_args: '--max-old-space-size=8192 --expose-gc',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
};
```

Then run:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring Commands

```bash
# Check current memory usage
pm2 monit

# View logs
pm2 logs benz-backend

# Restart if needed
pm2 restart benz-backend
```

## If Memory Issues Persist

1. **Increase server RAM**: Upgrade to server with more memory
2. **Use disk storage for uploads**: Switch multer to disk storage
3. **Reduce connection pool**: Lower `maxPoolSize` if database is bottleneck
4. **Add caching**: Use Redis for frequently accessed data
5. **Optimize queries**: Review and optimize database queries
6. **Split services**: Consider microservices architecture for heavy operations

---

**Status**: ✅ Memory limit increased to 8GB, monitoring enabled

