const catchAsync = require("../utils/catchAsync");
const Notification = require("../models/notificationModel");

exports.getNotifications = catchAsync(async (req, res, next) => {
  const notifications = await Notification.find({ user: req.user._id });

  res.status(200).json({
    status: "success",
    data: notifications,
  });
});
exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    read: false,
  });
  res.status(200).json({
    status: "success",
    count,
  });
});
