const catchAsync = require("../utils/catchAsync");
const Car = require("../models/carModel");
const AppError = require("../utils/appError");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const Driver = require("../models/driverModel");
const mongoose = require("mongoose");
const { notifyBookingCreated } = require("../services/notificationHelper");

exports.createBooking = catchAsync(async (req, res, next) => {
  const {
    car,
    pickupDate,
    returnDate,
    pickupLocation,
    driverId,
    licenseImage,
    insuranceImage,
  } = req.body;

  const carDoc = await Car.findById(car);
  if (!carDoc) return next(new AppError("Car not found", 404));

  if (carDoc.status !== "available") {
    return next(new AppError("Car is not available", 400));
  }

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));

  if (isNaN(days) || days <= 0) {
    return next(new AppError("Return date must be after pickup date", 400));
  }

  const totalPrice = days * carDoc.pricePerDay;
  const session = await mongoose.startSession();

  try {
    let driver;

    await session.withTransaction(async () => {
      if (driverId) {
        driver = await Driver.findOne({
          _id: driverId,
          user: req.user.id,
        }).session(session);

        if (!driver) throw new AppError("Driver not found", 404);
      } else if (licenseImage && insuranceImage) {
        const [newDriver] = await Driver.create(
          [
            {
              user: req.user.id,
              isDefault: true,
              license: { fileUrl: licenseImage, verified: false },
              insurance: { fileUrl: insuranceImage, verified: false },
            },
          ],
          { session }
        );

        driver = newDriver;

        await User.findByIdAndUpdate(
          req.user.id,
          { $push: { drivers: driver._id } },
          { session }
        );
      }
      const days = Math.ceil((returnDate - pickupDate) / (1000 * 60 * 60 * 24));
      const startMileage = carDoc.mileage;
      // Create booking (no array wrapper this time ✅)
      const booking = await Booking.create(
        [
          {
            user: req.user.id,
            driver: driver ? driver._id : undefined,
            car: carDoc._id,
            pickupDate,
            returnDate,
            pickupLocation,
            totalPrice,
            startMileage,
            status: driver ? "verification_pending" : "license_required",
          },
        ],
        { session }
      );

      // booking is still returned as array, so destructure
      const [createdBooking] = booking;

      // Populate directly
      await createdBooking.populate([
        { path: "user", select: "name email" },
        { path: "driver", select: "license insurance isDefault" },
        { path: "car", select: "name model pricePerDay images" },
      ]);

      // Send notification
      await notifyBookingCreated({
        userId: req.user.id,
        userName: req.user.name || "Customer",
        carName: `${carDoc.name} ${carDoc.model}`,
        bookingId: createdBooking._id,
        carId: carDoc._id,
        totalPrice,
      });

      res.status(201).json({
        status: "success",
        data: createdBooking,
      });
    });
  } catch (err) {
    console.error("❌ Booking error:", err);
    return next(
      err instanceof AppError
        ? err
        : new AppError("Booking failed. Please try again.", 500)
    );
  } finally {
    session.endSession();
  }
});
exports.getBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("car", "_id series model images pricePerDay")
    .populate("user", "fullName email phone")
    .populate("driver");
  if (!booking) return new AppError("Booking not Found", 404);
  res.status(200).json({ status: "success", data: booking });
});
exports.addBookingDriver = catchAsync(async (req, res, next) => {
  const { id: bookingId } = req.params;

  const { driverId, insuranceImage, licenseImage, fullName } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("Booking not found", 404));
    }
    if (driverId) {
      // Case 1: Using existing driver
      booking.driver = driverId;
      booking.status = "payment_pending";

      await booking.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        status: "success",
        data: booking,
      });
    } else {
      // Case 2: Creating new driver
      if (!fullName || !licenseImage || !insuranceImage) {
        await session.abortTransaction();
        session.endSession();
        return next(
          new AppError(
            "Full name, license image, and insurance image are required",
            400
          )
        );
      }

      const driver = await Driver.create(
        [
          {
            name: fullName,
            user: req.user.id,
            isDefault: false,
            license: {
              fileUrl: licenseImage,
              verified: false,
            },
            insurance: {
              fileUrl: insuranceImage,
              verified: false,
            },
          },
        ],
        { session }
      );

      booking.driver = driver[0]._id;
      booking.status = "verification_pending";
      await booking.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Populate the driver data in the response
      await booking.populate("driver");

      res.status(200).json({
        status: "success",
        data: booking,
      });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.log(err);
    next(err);
  }
});
