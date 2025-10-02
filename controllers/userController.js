const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// Register user with phone number
exports.registerUser = catchAsync(async (req, res, next) => {
  const { phone, fullName, licenseNumber } = req.body;
  const user = await User.create({ phone, fullName, licenseNumber });
  res.status(201).json({ status: "success", data: user });
});

// Get user profile
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));
  res.json({ status: "success", data: user });
});

// Update user profile
exports.updateMe = catchAsync(async (req, res, next) => {
  const updates = {
    fullName: req.body.fullName,
    licenseNumber: req.body.licenseNumber,
  };
  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
  });
  res.json({ status: "success", data: user });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json({ status: "success", data: user });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  res.json({ status: "success", data: user });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  res.json({ status: "success", results: users.length, data: users });
});
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  res.json({ status: "success", data: user });
});
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  res.json({ status: "success", data: user });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json({ status: "success", data: user });
});
