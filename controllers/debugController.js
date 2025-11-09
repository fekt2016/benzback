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
 * Production diagnostic endpoint
 * GET /api/v1/debug/diagnose
 * 
 * Checks for common deployment issues and WASM memory problems
 */
exports.diagnose = catchAsync(async (req, res, next) => {
  // Security check: Only allow in production with valid key
  if (process.env.NODE_ENV !== "production") {
    return res.status(404).json({
      status: "error",
      message: "Not found",
    });
  }

  const DEBUG_KEY = process.env.DEBUG_KEY;
  const clientKey = req.headers["x-debug-key"];

  if (!DEBUG_KEY || clientKey !== DEBUG_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Forbidden: Invalid debug key",
    });
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    node: process.version,
    memory: getMemoryStats(),
    checks: {},
  };

  // Check 1: p-limit import
  try {
    const pLimitModule = require("p-limit");
    const pLimit = pLimitModule.default || pLimitModule;
    const limit = pLimit(3);
    diagnostics.checks.pLimit = {
      status: "ok",
      message: "p-limit imports correctly",
      type: typeof limit,
    };
  } catch (e) {
    diagnostics.checks.pLimit = {
      status: "error",
      message: e.message,
      error: "p-limit import failed",
    };
  }

  // Check 2: Singleton services
  try {
    const stripeClient = require("../services/stripeClient.js");
    diagnostics.checks.stripeClient = {
      status: stripeClient.getStripe ? "ok" : "error",
      message: stripeClient.getStripe ? "Stripe singleton available" : "getStripe not found",
    };
  } catch (e) {
    diagnostics.checks.stripeClient = {
      status: "error",
      message: e.message,
    };
  }

  try {
    const cloudinaryClient = require("../services/cloudinaryClient.js");
    diagnostics.checks.cloudinaryClient = {
      status: cloudinaryClient.getCloudinary ? "ok" : "error",
      message: cloudinaryClient.getCloudinary ? "Cloudinary singleton available" : "getCloudinary not found",
    };
  } catch (e) {
    diagnostics.checks.cloudinaryClient = {
      status: "error",
      message: e.message,
    };
  }

  try {
    const sendGridClient = require("../services/sendGridClient.js");
    diagnostics.checks.sendGridClient = {
      status: sendGridClient.getSendGrid ? "ok" : "error",
      message: sendGridClient.getSendGrid ? "SendGrid singleton available" : "getSendGrid not found",
    };
  } catch (e) {
    diagnostics.checks.sendGridClient = {
      status: "error",
      message: e.message,
    };
  }

  // Check 3: Middleware
  try {
    require("../middleware/bookingUpload.js");
    diagnostics.checks.bookingUpload = {
      status: "ok",
      message: "bookingUpload.js loads successfully",
    };
  } catch (e) {
    diagnostics.checks.bookingUpload = {
      status: "error",
      message: e.message,
    };
  }

  // Check 4: Environment variables
  diagnostics.checks.envVars = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? "set" : "missing",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "set" : "missing",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "set" : "missing",
    NODE_OPTIONS: process.env.NODE_OPTIONS || "not set",
  };

  // Summary
  const allChecks = Object.values(diagnostics.checks);
  const errorCount = allChecks.filter((c) => c.status === "error").length;
  const warningCount = allChecks.filter((c) => c.status === "warning").length;

  diagnostics.summary = {
    total: allChecks.length,
    ok: allChecks.filter((c) => c.status === "ok").length,
    errors: errorCount,
    warnings: warningCount,
    status: errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok",
  };

  res.status(200).json({
    status: "success",
    data: diagnostics,
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

