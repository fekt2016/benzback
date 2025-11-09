const { catchAsync } = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { getMemoryStats, forceGC } = require("../utils/memoryMonitor");

/**
 * Production-safe debug endpoint for monitoring server health
 * GET /api/v1/debug/memory
 * 
 * Security: Requires DEBUG_KEY header and NODE_ENV=production
 */
exports.getMemoryStats = catchAsync(async (req, res, next) => {
  // Security check: Only allow in production with valid key
  if (process.env.NODE_ENV !== "production") {
    return res.status(404).json({
      status: "error",
      message: "Not found",
    });
  }

  const DEBUG_KEY = process.env.DEBUG_KEY;
  const clientKey = req.headers["x-debug-key"];

  // Check if DEBUG_KEY is configured
  if (!DEBUG_KEY) {
    return res.status(503).json({
      status: "error",
      message: "Debug endpoint not configured",
    });
  }

  // Check if client provided the correct key
  if (!clientKey || clientKey !== DEBUG_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Forbidden: Invalid debug key",
    });
  }

  // MEMORY OPTIMIZATION: Use dedicated memory monitoring utility
  // This provides consistent, optimized memory statistics
  const memoryStats = getMemoryStats();

  // Build response with enhanced memory stats
  const stats = {
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "development",
    uptimeMinutes: Math.floor(memoryStats.cpu.uptime / 60),
    uptimeSeconds: Math.floor(memoryStats.cpu.uptime),
    cpuLoad: memoryStats.cpu.loadAvg,
    memory: {
      heap: memoryStats.heap,
      rssMB: memoryStats.rss,
      externalMB: memoryStats.external,
      arrayBuffersMB: memoryStats.arrayBuffers,
    },
    system: memoryStats.system,
    gc: memoryStats.gc,
    pid: process.pid,
  };

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

/**
 * Reset memory baseline (optional enhancement)
 * POST /api/v1/debug/memory/reset
 * 
 * This can be used to track memory growth from a specific point
 */
exports.resetMemoryBaseline = catchAsync(async (req, res, next) => {
  // Security check: Only allow in production with valid key
  if (process.env.NODE_ENV !== "production") {
    return res.status(404).json({
      status: "error",
      message: "Not found",
    });
  }

  const DEBUG_KEY = process.env.DEBUG_KEY;
  const clientKey = req.headers["x-debug-key"];

  if (!DEBUG_KEY) {
    return res.status(503).json({
      status: "error",
      message: "Debug endpoint not configured",
    });
  }

  if (!clientKey || clientKey !== DEBUG_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Forbidden: Invalid debug key",
    });
  }

  // MEMORY OPTIMIZATION: Use memory monitor utility for GC
  const gcResult = forceGC();
  
  if (!gcResult) {
    return res.status(503).json({
      status: "error",
      message: "Garbage collection not available (run with --expose-gc flag)",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Memory baseline reset",
    data: {
      timestamp: new Date().toISOString(),
      memory: {
        before: {
          heapUsedMB: gcResult.before.heap.used,
          heapTotalMB: gcResult.before.heap.total,
          rssMB: gcResult.before.rss,
        },
        after: {
          heapUsedMB: gcResult.after.heap.used,
          heapTotalMB: gcResult.after.heap.total,
          rssMB: gcResult.after.rss,
        },
        freedMB: gcResult.freed.toFixed(2),
      },
    },
  });
});

