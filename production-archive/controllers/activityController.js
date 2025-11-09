const { catchAsync } = require("../utils/catchAsync");
const ActivityLog = require("../models/activityLogModel");
const AppError = require("../utils/appError");

/**
 * Get all activity logs (Admin and Executive only)
 * GET /api/v1/activity
 */
exports.getAllActivities = catchAsync(async (req, res, next) => {
  const {
    role,
    action,
    userId,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = req.query;

  // Build query
  const query = {};

  if (role) {
    query.role = role;
  }

  if (action) {
    query.action = { $regex: action, $options: "i" }; // Case-insensitive search
  }

  if (userId) {
    query.userId = userId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  // Get total count for pagination
  const total = await ActivityLog.countDocuments(query);

  // Fetch activities with pagination
  const activities = await ActivityLog.find(query)
    .populate("userId", "fullName email")
    .populate("driverId", "fullName email")
    .sort({ createdAt: -1 }) // Latest first
    .skip(skip)
    .limit(limitNum)
    .lean();

  res.status(200).json({
    status: "success",
    results: activities.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limitNum),
    data: activities,
  });
});

/**
 * Get current user's activity history
 * GET /api/v1/activity/me
 */
exports.getMyActivities = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 50 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  const query = {
    $or: [{ userId }, { driverId: userId }], // Include both user and driver activities
  };

  const total = await ActivityLog.countDocuments(query);

  const activities = await ActivityLog.find(query)
    .populate("userId", "fullName email")
    .populate("driverId", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  res.status(200).json({
    status: "success",
    results: activities.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limitNum),
    data: activities,
  });
});

/**
 * Get activity statistics (Admin and Executive only)
 * GET /api/v1/activity/stats
 */
exports.getActivityStats = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const dateQuery = {};
  if (startDate || endDate) {
    dateQuery.createdAt = {};
    if (startDate) {
      dateQuery.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      dateQuery.createdAt.$lte = new Date(endDate);
    }
  }

  // Get counts by role
  const roleStats = await ActivityLog.aggregate([
    { $match: dateQuery },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Get top actions
  const topActions = await ActivityLog.aggregate([
    { $match: dateQuery },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Get total count
  const total = await ActivityLog.countDocuments(dateQuery);

  // Get today's count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await ActivityLog.countDocuments({
    ...dateQuery,
    createdAt: { $gte: today },
  });

  res.status(200).json({
    status: "success",
    data: {
      total,
      todayCount,
      roleStats,
      topActions,
    },
  });
});

