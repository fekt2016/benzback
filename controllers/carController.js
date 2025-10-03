const Car = require("../models/carModel");
const catchAsync = require("../utils/catchAysnc");

exports.getAllCars = catchAsync(async (req, res, next) => {
  const cars = await Car.find();
  res.json({ status: "success", results: cars.length, data: cars });
});
