const ActivityLog = require("../models/activityLogModel");

/**
 * Utility helper to log activities
 * @param {Object} req - Express request object
 * @param {String} action - Action description (e.g., "User Logged In", "Booking Created")
 * @param {Object} details - Optional details object (e.g., { bookingId: "123", status: "confirmed" })
 * @param {Object} options - Optional configuration
 * @param {String} options.role - Override role (defaults to req.user?.role)
 * @param {String} options.userId - Override userId (defaults to req.user?._id)
 * @param {String} options.driverId - Driver ID if action is driver-related
 * @param {Object} options.metadata - Additional metadata
 * @param {Object} io - Socket.io instance (optional, for real-time broadcasting)
 */
const logActivity = async (req, action, details = null, options = {}, io = null) => {
  try {
    // Extract user information from request
    const userId = options.userId || req.user?._id || null;
    const role = options.role || req.user?.role || "system";
    const driverId = options.driverId || req.driver?._id || null;

    // Extract IP address and user agent
    const ipAddress =
      req.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection?.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";

    // Create activity log entry
    const activityLog = await ActivityLog.create({
      userId,
      driverId,
      role,
      action,
      details,
      ipAddress,
      userAgent,
      metadata: options.metadata || null,
    });

    // Populate user/driver info for socket emission
    await activityLog.populate("userId", "fullName email");
    if (driverId) {
      await activityLog.populate("driverId", "fullName email");
    }

    // Broadcast to admins via Socket.io if available
    if (io) {
      io.to("adminActivityRoom").emit("newActivityLog", {
        activityLog: activityLog.toObject(),
      });
    }

    return activityLog;
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main flow
    console.error("[ActivityLogger] Error logging activity:", error);
    return null;
  }
};

/**
 * Get Socket.io instance from app
 * Helper to extract io from req.app.get('io')
 */
const getIoFromRequest = (req) => {
  try {
    return req.app?.get("io") || null;
  } catch (error) {
    return null;
  }
};

/**
 * Convenience wrapper that automatically gets io from request
 */
const logActivityWithSocket = async (req, action, details = null, options = {}) => {
  const io = getIoFromRequest(req);
  return logActivity(req, action, details, options, io);
};

module.exports = {
  logActivity,
  logActivityWithSocket,
  getIoFromRequest,
};

