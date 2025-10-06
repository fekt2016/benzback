const catchAsync = require("../utils/catchAsync");
const Driver = require("../models/driverModel");

// exports.addDriver = catchAsync(async (req, res, next) => {
//   console.log(req.body);
//   const driver = await Driver.create({ ...req.body, user: req.user.id });
//   res.status(201).json({
//     status: "success",
//     data: driver,
//   });
// });
exports.getUserDrivers = catchAsync(async (req, res, next) => {
  const drivers = await Driver.find({ user: req.user.id });
  res.status(200).json({ status: "success", data: drivers });
});
