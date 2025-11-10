/**
 * Memory Monitoring Utility
 * 
 * Provides memory monitoring capabilities for production environments.
 * Logs memory usage at regular intervals and provides on-demand memory stats.
 * 
 * MEMORY OPTIMIZATION: Lightweight monitoring that doesn't accumulate data in memory.
 */

const v8 = require('v8');
const os = require('os');

/**
 * Get current memory statistics
 * @returns {object} Memory statistics object
 */
function getMemoryStats() {
  const memUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  
  return {
    heap: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      limit: Math.round(heapStats.heap_size_limit / 1024 / 1024 * 100) / 100, // MB
      percentage: Math.round((memUsage.heapUsed / heapStats.heap_size_limit) * 100 * 100) / 100, // %
    },
    rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100, // MB
    system: {
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 * 100) / 100, // MB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 * 100) / 100, // MB
      usedMemory: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 * 100) / 100, // MB
    },
    cpu: {
      loadAvg: os.loadavg(),
      uptime: process.uptime(), // seconds
    },
    gc: {
      available: typeof global.gc === 'function',
    },
  };
}

/**
 * Format memory stats for logging
 * @param {object} stats - Memory statistics object
 * @returns {string} Formatted string
 */
function formatMemoryStats(stats) {
  return `💾 Memory | Heap: ${stats.heap.used}MB / ${stats.heap.total}MB (${stats.heap.percentage}% of ${stats.heap.limit}MB limit) | RSS: ${stats.rss}MB | External: ${stats.external}MB`;
}

/**
 * Start periodic memory monitoring
 * MEMORY OPTIMIZATION: Uses minimal memory, logs only when threshold is exceeded
 * @param {object} options - Monitoring options
 * @param {number} options.intervalMs - Monitoring interval in milliseconds (default: 600000 = 10 minutes)
 * @param {number} options.heapThresholdMB - Heap usage threshold in MB to trigger warning (default: 400)
 * @param {boolean} options.logAlways - Whether to log even when below threshold (default: false)
 * @returns {NodeJS.Timeout} Interval ID for cleanup
 */
function startMemoryMonitoring(options = {}) {
  const {
    intervalMs = 600000, // 10 minutes default
    heapThresholdMB = 400, // 400MB threshold (75% of 512MB limit)
    logAlways = false,
  } = options;

  const interval = setInterval(() => {
    const stats = getMemoryStats();
    
    // Only log if above threshold or if logAlways is true
    if (stats.heap.used > heapThresholdMB || logAlways) {
      console.log(formatMemoryStats(stats));
      
      // If memory is high, attempt garbage collection if available
      if (stats.heap.used > heapThresholdMB && global.gc) {
        const beforeGC = stats.heap.used;
        global.gc();
        
        // Get stats after GC
        const afterStats = getMemoryStats();
        const freed = beforeGC - afterStats.heap.used;
        
        if (freed > 0) {
          console.log(`🧹 GC ran. Freed ${freed.toFixed(2)}MB. Memory after: ${afterStats.heap.used}MB`);
        }
      }
    }
  }, intervalMs);

  return interval;
}

/**
 * Force garbage collection if available
 * @returns {object|null} Memory stats before and after GC, or null if GC not available
 */
function forceGC() {
  if (!global.gc) {
    return null;
  }

  const before = getMemoryStats();
  global.gc();
  const after = getMemoryStats();

  return {
    before,
    after,
    freed: before.heap.used - after.heap.used,
  };
}

module.exports = {
  getMemoryStats,
  formatMemoryStats,
  startMemoryMonitoring,
  forceGC,
};
