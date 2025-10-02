const Driver = require("../models/driverModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");

// Add additional driver
exports.addDriver = catchAsync(async (req, res, next) => {
  console.log("req.body", req.body);
  const driver = await Driver.create({ ...req.body, user: req.user.id });
  res.status(201).json({ status: "success", data: driver });
});

exports.getUserDrivers = catchAsync(async (req, res, next) => {
  console.log("userId", req.user.id);
  const drivers = await Driver.find();
  res.json({ status: "success", results: drivers.length, data: drivers });
});

exports.verifyDriverLicense = catchAsync(async (req, res, next) => {
  console.log("driver and booking is been update");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const driverId = req.params.id;
    const { license, insurance } = req.body;
    // console.log("req.body", req.body);

    // 1. Find the driver (inside transaction)
    const driver = await Driver.findById(driverId).session(session);
    if (!driver) {
      await session.abortTransaction();
      session.endSession();
      next(new AppError("Driver not found", 404));
    }

    // 2. Update only provided fields
    if (license) {
      if (license.number !== undefined) driver.license.number = license.number;
      if (license.issuedBy !== undefined)
        driver.license.issuedBy = license.issuedBy;
      if (license.expiryDate !== undefined)
        driver.license.expiryDate = license.expiryDate;
      if (license.verified !== undefined)
        driver.license.verified = license.verified;
    }

    if (insurance) {
      if (insurance.provider !== undefined)
        driver.insurance.provider = insurance.provider;
      if (insurance.policyNumber !== undefined)
        driver.insurance.policyNumber = insurance.policyNumber;
      if (insurance.expiryDate !== undefined)
        driver.insurance.expiryDate = insurance.expiryDate;
      if (insurance.verified !== undefined)
        driver.insurance.verified = insurance.verified;
    }

    // 3. Save driver
    await driver.save({ session });

    // 4. Update ALL bookings for this driver
    const bookingUpdate = await Booking.updateMany(
      { driver: driver._id },
      { $set: { status: "payment_pending" } },
      { session }
    );

    // If no booking was updated → rollback
    if (bookingUpdate.modifiedCount === 0) {
      await session.abortTransaction();
      session.endSession();
      next(new AppError("No bookings found for this driver", 404));
    }

    // 5. Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.json({
      status: "success",
      data: {
        driver,
        updatedBookings: bookingUpdate.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error verifying/updating driver:", error);

    // Rollback on error
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({
      status: "error",
      message: "Server error while verifying/updating driver",
    });
  }
});

// // Get all drivers
// exports.getAllDrivers = catchAsync(async (req, res, next) => {
//   const drivers = await Driver.find();
//   res.json({ status: "success", results: drivers.length, data: drivers });
// });

// // Get driver by ID
// exports.getDriver = catchAsync(async (req, res, next) => {
//   const driver = await Driver.findById(req.params.id);
//   res.json({ status: "success", data: driver });
// });

// // Update driver
// exports.updateDriver = catchAsync(async (req, res, next) => {
//   const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//   });
//   res.json({ status: "success", data: driver });
// });
