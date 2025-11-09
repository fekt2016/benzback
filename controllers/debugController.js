const os = require("os");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("../utils/appError");

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

  // Collect system metrics
  const memory = process.memoryUsage();
  const cpuLoad = os.loadavg();
  const uptimeSeconds = process.uptime();
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);

  // Format memory values (convert bytes to MB, round to 2 decimals)
  const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  // Format CPU load (round to 2 decimals)
  const formatCPU = (load) => Math.round(load * 100) / 100;

  // Build response
  const stats = {
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "development",
    uptimeMinutes: uptimeMinutes,
    uptimeSeconds: Math.floor(uptimeSeconds),
    cpuLoad: cpuLoad.map(formatCPU),
    memory: {
      heapUsedMB: formatMB(memory.heapUsed),
      heapTotalMB: formatMB(memory.heapTotal),
      rssMB: formatMB(memory.rss),
      externalMB: formatMB(memory.external),
      arrayBuffersMB: formatMB(memory.arrayBuffers || 0),
    },
    gcAvailable: typeof global.gc === "function",
    pid: process.pid,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    totalMemoryMB: formatMB(os.totalmem()),
    freeMemoryMB: formatMB(os.freemem()),
    cpus: os.cpus().length,
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

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const memory = process.memoryUsage();
  const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  res.status(200).json({
    status: "success",
    message: "Memory baseline reset",
    data: {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMB: formatMB(memory.heapUsed),
        heapTotalMB: formatMB(memory.heapTotal),
        rssMB: formatMB(memory.rss),
      },
    },
  });
});

