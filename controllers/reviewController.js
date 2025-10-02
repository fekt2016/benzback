const Review = require("../models/reviewModel");
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
const SecurityLog = require("../models/securityLogModel");

// Add review
exports.addReview = catchAsync(async (req, res, next) => {
  const { userId, carId, rating, comment, title } = req.body;
  const review = await Review.create({
    user: userId,
    car: carId,
    rating,
    comment,
    title,
  });
  console.res.status(201).json({ status: "success", data: review });
});

// Get reviews for a car
exports.getCarReviews = catchAsync(async (req, res, next) => {
  const carId = new mongoose.Types.ObjectId(req.params.id);
  const reviews = await Review.find({ car: carId }).populate(
    "user",
    "fullName avatar"
  );

  res.json({ status: "success", results: reviews.length, data: reviews });
});

exports.getUserReviews = catchAsync(async (req, res, next) => {
  const userId = new mongoose.Types.ObjectId(req.params.id);
  if (!userId) {
    return next(new AppError("User not found", 404));
  }
  const reviews = await Review.find({
    user: userId,
    status: "active",
  }).populate("car", "_id series model images");
  res.json({ status: "success", results: reviews.length, data: reviews });
});
exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json({ status: "success", data: review });
});
exports.deleteReview = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.role === "admin") {
    const review = await Review.findByIdAndDelete(req.params.id);
    await securityLogService.logEvent({
      user: decoded.id,
      userTypeModel: "User",
      eventType: "logout",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Admin Delete Review successfully",
    });
    res.json({ status: "success", data: review });
  }
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { status: "inactive" },
    {
      new: true,
    }
  );
  review.updatedAt = Date.now();
  review.save();
  res.json({ status: "success", data: review });
});
