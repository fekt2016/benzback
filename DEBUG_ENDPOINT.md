# Production Debug Endpoint

## Overview

A secure debug endpoint for monitoring server health in production. Provides real-time metrics for memory, CPU, uptime, and system information.

## Endpoints

### GET `/api/v1/debug/memory`

Returns comprehensive server performance metrics.

**Security:**
- Requires `x-debug-key` header matching `DEBUG_KEY` environment variable
- Rate limited to 10 requests per minute per IP
- Only accessible when `DEBUG_KEY` is configured

**Request:**
```bash
curl -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "timestamp": "2025-11-09T10:05:00.000Z",
    "node": "v18.20.0",
    "env": "production",
    "uptimeMinutes": 54,
    "uptimeSeconds": 3240,
    "cpuLoad": [0.05, 0.09, 0.12],
    "memory": {
      "heapUsedMB": 120.43,
      "heapTotalMB": 150.32,
      "rssMB": 190.10,
      "externalMB": 4.32,
      "arrayBuffersMB": 2.15
    },
    "gcAvailable": true,
    "pid": 12345,
    "hostname": "ip-172-31-20-50",
    "platform": "linux",
    "arch": "x64",
    "totalMemoryMB": 8192.00,
    "freeMemoryMB": 2048.50,
    "cpus": 4
  }
}
```

### POST `/api/v1/debug/memory/reset`

Resets memory baseline by forcing garbage collection. Useful for tracking memory growth from a specific point.

**Security:**
- Same security requirements as GET endpoint
- Rate limited to 10 requests per minute per IP

**Request:**
```bash
curl -X POST \
     -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory/reset
```

**Response:**
```json
{
  "status": "success",
  "message": "Memory baseline reset",
  "data": {
    "timestamp": "2025-11-09T10:05:00.000Z",
    "memory": {
      "heapUsedMB": 115.20,
      "heapTotalMB": 150.32,
      "rssMB": 185.50
    }
  }
}
```

## Configuration

### Environment Variable

Add to your `config.env`:

```bash
DEBUG_KEY=your-secure-random-key-here
```

**Security Recommendations:**
- Use a long, random string (at least 32 characters)
- Don't commit to version control
- Rotate periodically
- Use different keys for different environments

**Generate a secure key:**
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

## Security Features

### 1. Header-Based Authentication
- Requires `x-debug-key` header
- Must match `DEBUG_KEY` environment variable
- Returns 403 if key is missing or incorrect

### 2. Rate Limiting
- 10 requests per minute per IP
- Prevents abuse and DoS attacks
- Returns 429 if limit exceeded

### 3. Environment Check
- Only works when `DEBUG_KEY` is configured
- Returns 503 if not configured
- Safe to leave in code (won't work without key)

## Usage Examples

### Basic Monitoring
```bash
# Get current memory stats
curl -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory
```

### Monitor Memory Growth
```bash
# Reset baseline
curl -X POST \
     -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory/reset

# Check memory after operations
curl -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory
```

### Automated Monitoring Script
```bash
#!/bin/bash
DEBUG_KEY="your-secret-key"
API_URL="http://localhost:3001/api/v1/debug/memory"

while true; do
  echo "=== $(date) ==="
  curl -s -H "x-debug-key: $DEBUG_KEY" "$API_URL" | jq '.data.memory'
  sleep 60
done
```

### Using with Monitoring Tools

**Prometheus-style metrics:**
```bash
curl -H "x-debug-key: your-secret-key" \
     http://localhost:3001/api/v1/debug/memory | \
     jq -r '.data.memory | to_entries[] | "memory_\(.key) \(.value)"'
```

## Response Fields

### Memory Metrics
- `heapUsedMB`: Memory actively used by JavaScript objects
- `heapTotalMB`: Total heap memory allocated by V8
- `rssMB`: Resident Set Size (total process memory)
- `externalMB`: Memory used by C++ objects bound to JavaScript
- `arrayBuffersMB`: Memory used by ArrayBuffers

### System Metrics
- `cpuLoad`: 1, 5, and 15-minute load averages
- `uptimeMinutes`: Server uptime in minutes
- `uptimeSeconds`: Server uptime in seconds
- `totalMemoryMB`: Total system memory
- `freeMemoryMB`: Available system memory
- `cpus`: Number of CPU cores

### Environment Info
- `node`: Node.js version
- `env`: NODE_ENV value
- `pid`: Process ID
- `hostname`: System hostname
- `platform`: Operating system platform
- `arch`: CPU architecture
- `gcAvailable`: Whether manual GC is available

## Error Responses

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Forbidden: Invalid debug key"
}
```

### 429 Too Many Requests
```json
{
  "status": "error",
  "message": "Too many requests to debug endpoint. Please try again later."
}
```

### 503 Service Unavailable
```json
{
  "status": "error",
  "message": "Debug endpoint not configured"
}
```

## Best Practices

1. **Keep DEBUG_KEY Secret**
   - Never commit to version control
   - Use environment variables
   - Rotate periodically

2. **Monitor Responsibly**
   - Don't poll too frequently (rate limit is 10/min)
   - Use for troubleshooting, not constant monitoring
   - Consider using proper monitoring tools for production

3. **Security**
   - Use HTTPS in production
   - Consider IP whitelisting for additional security
   - Log access to debug endpoint

4. **Performance**
   - Endpoint is lightweight but still adds overhead
   - Use sparingly in high-traffic scenarios
   - Consider caching results if needed

## Integration with Monitoring Tools

### Prometheus
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'nodejs-app'
    metrics_path: '/api/v1/debug/memory'
    static_configs:
      - targets: ['localhost:3001']
    headers:
      x-debug-key: ['your-secret-key']
```

### Grafana
Use the endpoint as a JSON data source and create dashboards for:
- Memory usage over time
- CPU load trends
- Uptime monitoring
- System resource utilization

## Troubleshooting

### Endpoint Returns 403
- Check that `DEBUG_KEY` is set in environment
- Verify header name is exactly `x-debug-key`
- Ensure key matches exactly (case-sensitive)

### Endpoint Returns 503
- `DEBUG_KEY` environment variable is not set
- Add `DEBUG_KEY` to your `config.env` file

### Rate Limit Errors
- Wait 1 minute between requests
- Or use different IP addresses
- Consider increasing limit if needed (edit `debugRoutes.js`)

## Files Modified

1. `routes/debugRoutes.js` - Route definitions
2. `controllers/debugController.js` - Controller logic
3. `app.js` - Route mounting
4. `config.env` - DEBUG_KEY configuration (already present)

---

**Status:** ✅ Production Ready
**Security:** ✅ Secure with header-based auth and rate limiting
**Performance:** ✅ Lightweight, minimal overhead

