const catchAsync = require("../utils/catchAsync");
const Car = require("../models/carModel");
const AppError = require("../utils/appError");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const Driver = require("../models/driverModel");
const mongoose = require("mongoose");
const { notifyBookingCreated } = require("../services/notificationHelper");

const calculateBookingDetails = (pickupDate, returnDate, pricePerDay) => {
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));

  if (isNaN(days) || days <= 0) {
    throw new AppError("Return date must be after pickup date", 400);
  }

  const basePrice = days * pricePerDay;
  const taxAmount = basePrice * 0.08; // 8% tax
  const totalPrice = basePrice + taxAmount;

  return { days, basePrice, taxAmount, totalPrice };
};

// Helper function to determine booking status based on driver verification
const determineBookingStatus = (driver, hasDriverData = false) => {
  if (!hasDriverData) return "license_required";
  if (driver?.verified === true) return "pending_payment";
  return "verification_pending";
};

exports.createBooking = catchAsync(async (req, res, next) => {
  const {
    car,
    pickupDate,
    returnDate,
    pickupLocation,
    driverId,
    pickupTime = "10:00 AM",
    returnTime = "10:00 AM",
    licenseImage,
    insuranceImage,
    driverName,
  } = req.body;
  //Validate car availability
  const carDoc = await Car.findById(car);
  if (!carDoc) return next(new AppError("Car not found", 404));
  if (carDoc.status !== "available") {
    return next(new AppError("Car is not available", 400));
  }
  const { days, basePrice, taxAmount, totalPrice } = calculateBookingDetails(
    pickupDate,
    returnDate,
    carDoc.pricePerDay
  );
  // const pickup = new Date(pickupDate);
  // const returnD = new Date(returnDate);
  // const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
  // if (isNaN(days) || days <= 0) {
  //   return next(new AppError("Return date must be after pickup date", 400));
  // }
  // const totalPrice = days * carDoc.pricePerDay;
  const session = await mongoose.startSession();
  try {
    let driver;
    let hasDriverData = false;
    await session.withTransaction(async () => {
      if (driverId) {
        driver = await Driver.findOne({
          _id: driverId,
          user: req.user.id,
        }).session(session);

        if (!driver) throw new AppError("Driver not found", 404);
        hasDriverData = true;
      } else if (licenseImage && insuranceImage) {
        const [newDriver] = await Driver.create(
          [
            {
              name: driverName,
              user: req.user.id,
              isDefault: true,
              license: { fileUrl: licenseImage, verified: false },
              insurance: { fileUrl: insuranceImage, verified: false },
            },
          ],
          { session }
        );
        driver = newDriver;
        hasDriverData = true;
        await User.findByIdAndUpdate(
          req.user.id,
          { $push: { drivers: driver._id } },
          { session }
        );
      }
      const status = determineBookingStatus(driver, hasDriverData);

      const [booking] = await Booking.create(
        [
          {
            user: req.user.id,
            driver: driver ? driver._id : undefined,
            car: carDoc._id,
            pickupDate,
            returnDate,
            pickupTime,
            returnTime,
            pickupLocation,
            returnLocation: pickupLocation,
            basePrice,
            totalPrice,
            taxAmount,
            startMileage: carDoc.currentOdometer,
            status,
            rentalTerms: {
              mileageLimit: 200,
              fuelPolicy: "full-to-full",
              lateReturnFee: 0.5,
              cleaningFee: 75,
              damageDeposit: 500,
            },
            statusHistory: [
              {
                status: status,
                timestamp: new Date(),
                chnagedBy: req.user._id,
                notes: "Booking created",
              },
            ],
          },
        ],
        { session }
      );

      await booking.populate([
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
        message: "Booking created successfully",
        data: booking,
      });
    });
  } catch (err) {
    console.log("❌ Booking error:", err);
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

exports.getUserBookings = catchAsync(async (req, res, next) => {
  const booking = await Booking.find({ user: req.user._id })
    .populate("car", "_id series model images")
    .populate("driver")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: booking.length,
    data: booking,
  });
});

exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );
  res.json({ status: "success", data: booking });
});

exports.checkInBooking = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const {
    checkInTime = new Date(),
    mileage,
    fuelLevel,
    notes,
    checkedInBy,
  } = req.body;

  // Validate required parameters
  if (!bookingId) {
    return next(new AppError("Booking ID is required", 400));
  }

  // Find the booking and populate necessary fields
  const booking = await Booking.findById(bookingId)
    .populate("car")
    .populate("user", "name email phone");

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // Validate booking status - only allow check-in for confirmed bookings
  if (booking.status !== "confirmed" && booking.status !== "pending") {
    return next(
      new AppError(
        `Cannot check in booking with status: ${booking.status}. Booking must be confirmed.`,
        400
      )
    );
  }

  // Validate pickup date - can't check in before pickup date
  const pickupDate = new Date(booking.pickupDate);
  const today = new Date();

  if (today < pickupDate) {
    return next(
      new AppError(
        `Cannot check in before pickup date: ${pickupDate.toLocaleDateString()}`,
        400
      )
    );
  }

  // Validate required check-in data
  if (!mileage) {
    return next(new AppError("Odometer reading is required for check-in", 400));
  }

  if (fuelLevel === undefined || fuelLevel === null) {
    return next(new AppError("Fuel level is required for check-in", 400));
  }

  // Validate fuel level (0-100)
  if (fuelLevel < 0 || fuelLevel > 100) {
    return next(new AppError("Fuel level must be between 0 and 100", 400));
  }

  // Validate odometer reading (should be a positive number)
  if (mileage < 0) {
    return next(
      new AppError("Odometer reading must be a positive number", 400)
    );
  }

  // Check if car is available
  if (booking.car.status !== "available") {
    return next(
      new AppError(
        `Car is currently ${booking.car.status}. Cannot proceed with check-in.`,
        400
      )
    );
  }

  // Start a transaction to ensure data consistency
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update booking status and check-in information
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "active",
        checkInTime: new Date(checkInTime),
        checkInData: {
          mileage,
          fuelLevel,
          notes: notes || "",
          checkedInBy: checkedInBy || req.user?.id || "system",
          checkedInAt: new Date(),
        },
        $push: {
          statusHistory: {
            status: "active",
            timestamp: new Date(),
            changedBy: checkedInBy || req.user?.id || "system",
            notes: "Customer check-in completed",
          },
        },
      },
      {
        new: true,
        runValidators: true,
        session,
      }
    )
      .populate("car")
      .populate("user", "name email phone");

    // Update car status to 'rented'
    await Car.findByIdAndUpdate(
      booking.car._id,
      {
        status: "rented",
        currentOdometer: odometerReading,
        lastRented: new Date(),
        $push: {
          rentalHistory: {
            booking: bookingId,
            rentedAt: new Date(),
            odometerAtRental: odometerReading,
          },
        },
      },
      { session }
    );

    // Create a rental session record
    await RentalSession.create(
      [
        {
          booking: bookingId,
          car: booking.car._id,
          user: booking.user._id,
          startTime: new Date(checkInTime),
          startOdometer: odometerReading,
          startFuelLevel: fuelLevel,
          status: "active",
          pickupLocation: booking.pickupLocation,
        },
      ],
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();

    // Send check-in confirmation notification
    try {
      // Send SMS notification to customer
      await sendSMSNotification(
        booking.user.phone,
        `Your Mercedes-Benz ${booking.car.model} rental has been checked in successfully. Rental is now active. Enjoy your trip!`
      );

      // Send email receipt
      await sendCheckInEmail(booking.user.email, updatedBooking);
    } catch (notificationError) {
      console.error("Notification sending failed:", notificationError);
      // Don't fail the check-in if notifications fail
    }

    // Log the check-in activity
    console.log(
      `Booking ${bookingId} checked in successfully by ${
        checkedInBy || "system"
      }`
    );

    res.status(200).json({
      status: "success",
      message: "Booking checked in successfully",
      data: {
        booking: {
          id: updatedBooking._id,
          status: updatedBooking.status,
          checkInTime: updatedBooking.checkInTime,
          car: {
            model: updatedBooking.car.model,
            licensePlate: updatedBooking.car.licensePlate,
          },
          user: {
            name: updatedBooking.user.name,
            email: updatedBooking.user.email,
          },
          checkInData: updatedBooking.checkInData,
        },
      },
    });
  } catch (error) {
    // If anything fails, abort the transaction
    await session.abortTransaction();

    console.error("Check-in transaction failed:", error);
    return next(new AppError("Check-in failed. Please try again.", 500));
  } finally {
    session.endSession();
  }
});
