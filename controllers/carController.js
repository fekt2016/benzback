const Car = require("../models/carModel");
const catchAsync = require("../utils/catchAsync");

exports.getAllCars = catchAsync(async (req, res, next) => {
  const cars = await Car.find();
  res.json({ status: "success", results: cars.length, data: cars });
});
exports.getCar = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const car = await Car.findById(id);
  console.log(car);
  res.status(200).json({
    status: "success",
    data: car,
  });
});
