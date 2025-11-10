const {catchAsync} = require("../utils/catchAsync");
const Notification = require("../models/notificationModel");

exports.getNotifications = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  
  const filter = { user: req.user._id };

  const { data: notifications, pagination } = await paginateQuery(Notification, filter, req, {
    queryModifier: (query) => query.sort({ createdAt: -1 }),
    defaultLimit: 20,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: notifications,
  });
});
exports.getUnreadCount = catchAsync(
  
  async (req, res, next) => {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.status(200).json({
      status: "success",
      count,
    });
  }
);
exports.markAllAsRead = catchAsync( async (req, res, next) => {
  const notifications = await Notification.updateMany(
    { user: req.user._id },
    { $set: { read: true } }
  );
  if (!notifications) return next(new AppError("No notifications found", 404));
  res.status(200).json({
    status: "success",
  });
});
exports.markAsRead = catchAsync( async (req, res, next) => {
  const notification = await Notification.updateMany(
    { user: req.user._id },
    { $set: { read: true } }
  );
  if (!notification) return next(new AppError("No notifications found", 404));
  res.status(200).json({
    status: "success",
  });
});
exports.deleteNotification = catchAsync(
 
  async (req, res, next) => {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
    });
  }
);
