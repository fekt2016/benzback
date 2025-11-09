const express = require("express");
const debugController = require("../controllers/debugController");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Rate limiting for debug endpoints (prevent abuse)
// Allow 10 requests per minute per IP
const debugRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    status: "error",
    message: "Too many requests to debug endpoint. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/v1/debug/memory
 * 
 * Returns live server performance metrics:
 * - Memory usage (heap, RSS, external)
 * - CPU load average
 * - Uptime
 * - Node.js environment info
 * 
 * Security:
 * - Requires NODE_ENV=production
 * - Requires x-debug-key header matching DEBUG_KEY env var
 * 
 * Example request:
 * curl -H "x-debug-key: your-secret-key" http://localhost:3001/api/v1/debug/memory
 */
router.get("/memory", debugRateLimit, debugController.getMemoryStats);

/**
 * POST /api/v1/debug/memory/reset
 * 
 * Resets memory baseline by forcing garbage collection.
 * Useful for tracking memory growth from a specific point.
 * 
 * Security:
 * - Requires NODE_ENV=production
 * - Requires x-debug-key header matching DEBUG_KEY env var
 */
router.post("/memory/reset", debugRateLimit, debugController.resetMemoryBaseline);

/**
 * GET /api/v1/debug/diagnose
 * 
 * Production diagnostic endpoint that checks:
 * - p-limit import status
 * - Singleton services (Stripe, Cloudinary, SendGrid)
 * - Middleware loading
 * - Environment variables
 * - Memory statistics
 * 
 * Security:
 * - Requires NODE_ENV=production
 * - Requires x-debug-key header matching DEBUG_KEY env var
 */
router.get("/diagnose", debugRateLimit, debugController.diagnose);

module.exports = router;

