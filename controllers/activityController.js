const { catchAsync } = require("../utils/catchAsync");
const ActivityLog = require("../models/activityLogModel");
const AppError = require("../utils/appError");

/**
 * Get all activity logs (Admin and Executive only)
 * GET /api/v1/activity
 */
exports.getAllActivities = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const {
    role,
    action,
    userId,
    startDate,
    endDate,
  } = req.query;

  // Build query
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (action) {
    filter.action = { $regex: action, $options: "i" }; // Case-insensitive search
  }

  if (userId) {
    filter.userId = userId;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  const { data: activities, pagination } = await paginateQuery(ActivityLog, filter, req, {
    queryModifier: (query) => query
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 }), // Latest first
    defaultLimit: 50,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: activities,
  });
});

/**
 * Get current user's activity history
 * GET /api/v1/activity/me
 */
exports.getMyActivities = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const userId = req.user._id;

  const filter = {
    $or: [{ userId }, { driverId: userId }], // Include both user and driver activities
  };

  const { data: activities, pagination } = await paginateQuery(ActivityLog, filter, req, {
    queryModifier: (query) => query
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 }),
    defaultLimit: 50,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
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

