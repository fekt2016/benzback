const Booking = require("../models/bookingModel");
const catchAsync = require("../utils/catchAsync");
const Car = require("../models/carModel");
const Driver = require("../models/driverModel");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { notifyBookingCreated } = require("../service/notificationHelper");

// Create booking

// exports.createBooking = catchAsync(async (req, res, next) => {
//   const {
//     car,
//     pickupDate,
//     returnDate,
//     pickupLocation,
//     driverId,
//     insuranceImage,
//     licenseImage,
//   } = req.body;

//   // 1. Validate car exists & availability
//   const carDoc = await Car.findById(car);
//   if (!carDoc) return next(new AppError("Car not found", 404));
//   if (carDoc.status !== "available") {
//     return next(new AppError("Car is not available", 400));
//   }

//   // 2. Validate dates
//   const pickup = new Date(pickupDate);
//   const returnD = new Date(returnDate);
//   const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
//   if (isNaN(days) || days <= 0) {
//     return next(new AppError("Return date must be after pickup date", 400));
//   }

//   const totalPrice = days * carDoc.pricePerDay;

//   // ---------- TRANSACTION ----------
//   const session = await mongoose.startSession();

//   try {
//     let driver;

//     await session.withTransaction(async () => {
//       if (driverId) {
//         driver = await Driver.findOne({
//           _id: driverId,
//           user: req.user.id,
//         }).session(session);
//         if (!driver) throw new AppError("Driver not found", 404);
//       } else if (licenseImage && insuranceImage) {
//         const [newDriver] = await Driver.create(
//           [
//             {
//               user: req.user.id,
//               isDefault: true,
//               license: { fileUrl: licenseImage, verified: false },
//               insurance: { fileUrl: insuranceImage, verified: false },
//             },
//           ],
//           { session }
//         );
//         driver = newDriver;

//         await User.findByIdAndUpdate(
//           req.user.id,
//           { $push: { drivers: driver._id } },
//           { session }
//         );
//       }

//       const [booking] = await Booking.create(
//         [
//           {
//             user: req.user.id,
//             driver: driver ? driver._id : undefined,
//             car: carDoc._id,
//             pickupDate,
//             returnDate,
//             pickupLocation,
//             totalPrice,
//             status: driver ? "verification_pending" : "license_required",
//           },
//         ],
//         { session }
//       );

//       const populatedBooking = await booking.populate([
//         { path: "driver", select: "license insurance isDefault" },
//         { path: "car", select: "make model pricePerDay images" },
//       ]);

//       // Send notifications
//       await notifyBookingCreated({
//         user: populatedBooking.user._id,
//         userName: populatedBooking.user.name,
//         carName: `${populatedBooking.car.name} ${populatedBooking.car.model}`,
//         bookingId: populatedBooking._id,
//         car: populatedBooking.car._id,
//       });

//       res.status(201).json({
//         status: "success",
//         data: booking,
//       });
//     });

//     session.endSession();
//   } catch (err) {
//     console.log(err);
//     session.endSession();
//     return next(
//       err instanceof AppError
//         ? err
//         : new AppError("Booking failed. Please try again.", 500)
//     );
//   }
// });
exports.createBooking = catchAsync(async (req, res, next) => {
  const {
    car,
    pickupDate,
    returnDate,
    pickupLocation,
    driverId,
    insuranceImage,
    licenseImage,
  } = req.body;

  // 1. Validate car exists & availability
  const carDoc = await Car.findById(car);
  if (!carDoc) return next(new AppError("Car not found", 404));
  if (carDoc.status !== "available") {
    return next(new AppError("Car is not available", 400));
  }

  // 2. Validate dates
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
  if (isNaN(days) || days <= 0) {
    return next(new AppError("Return date must be after pickup date", 400));
  }

  const totalPrice = days * carDoc.pricePerDay;

  // ---------- TRANSACTION ----------
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

      const [booking] = await Booking.create(
        [
          {
            user: req.user.id,
            driver: driver ? driver._id : undefined,
            car: carDoc._id,
            pickupDate,
            returnDate,
            pickupLocation,
            totalPrice,
            status: driver ? "verification_pending" : "license_required",
          },
        ],
        { session }
      );

      const populatedBooking = await booking.populate([
        { path: "user", select: "name email" }, // Add user population
        { path: "driver", select: "license insurance isDefault" },
        { path: "car", select: "name model pricePerDay images" }, // Changed from make to name
      ]);

      // ✅ FIXED: Correct notification call
      await notifyBookingCreated({
        userId: req.user.id, // Use req.user.id directly
        userName: req.user.name || "Customer", // Use req.user.name or fallback
        carName: `${carDoc.name} ${carDoc.model}`, // Use carDoc directly
        bookingId: booking._id,
        carId: carDoc._id,
        totalPrice: totalPrice, // Add totalPrice which is required
      });

      res.status(201).json({
        status: "success",
        data: booking,
      });
    });

    session.endSession();
  } catch (err) {
    console.log("❌ Booking error:", err);
    session.endSession();
    return next(
      err instanceof AppError
        ? err
        : new AppError("Booking failed. Please try again.", 500)
    );
  }
});

exports.userUpdateBooking = catchAsync(async (req, res, next) => {
  const { id: bookingId } = req.params;
  const {
    pickupDate,
    returnDate,
    pickupLocation,
    driverId, // existing driver
    licenseImage, // if creating new driver
    insuranceImage, // if creating new driver
    name, // driver name (optional for new driver)
  } = req.body;

  // Start session
  const session = await mongoose.startSession();

  try {
    let booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      session.endSession();
      return next(new AppError("Booking not found", 404));
    }

    // ✅ Update basic booking fields
    if (pickupDate) booking.pickupDate = pickupDate;
    if (returnDate) booking.returnDate = returnDate;
    if (pickupLocation) booking.pickupLocation = pickupLocation;

    let driver;

    await session.withTransaction(async () => {
      if (driverId) {
        // 🟢 Attach existing driver
        driver = await Driver.findOne({
          _id: driverId,
          user: req.user.id,
        }).session(session);

        if (!driver) {
          throw new AppError("Driver not found for this user", 404);
        }

        booking.driver = driver._id;
        await booking.save({ session });
      } else if (licenseImage && insuranceImage) {
        console.log("licenseImage & insuranceImage");
        // 🟢 Create new driver and attach to user + booking
        const [newDriver] = await Driver.create(
          [
            {
              name: name || "New Driver",
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

        driver = newDriver;

        // Push driver to user
        await User.findByIdAndUpdate(
          req.user.id,
          { $push: { drivers: driver._id } },
          { session }
        );

        booking.driver = driver._id;

        await booking.save({ session });
      } else {
        // Just update booking fields (no driver change)
        await booking.save({ session });
      }
    });

    session.endSession();

    // populate driver and car for response
    await booking.populate([
      { path: "driver", select: "name license insurance verified" },
      { path: "car", select: "make model pricePerDay images" },
    ]);

    res.status(200).json({
      status: "success",
      data: booking,
    });
  } catch (err) {
    session.endSession();
    next(err);
  }
});

exports.addBookingDriver = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
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
    // Always abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.log(err);
    next(err);
  }
});

// Get all bookings

exports.getUserBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id })
    .populate("car", "_id series model images")
    .populate("driver");
  res.json({ status: "success", results: bookings.length, data: bookings });
});
// exports.cancelBooking = catchAsync(async (req, res, next) => {
//   const booking = await Booking.findByIdAndUpdate(
//     req.params.id,
//     { status: "cancelled" },
//     { new: true }
//   );
//   res.json({ status: "success", data: booking });
// });

exports.getBooking = catchAsync(async (req, res, next) => {
  const id = new mongoose.Types.ObjectId(req.params.id);
  const booking = await Booking.findById(id)
    .populate("car", "_id series model images pricePerDay")
    .populate("user", "fullName email phone")
    .populate("driver");

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }
  console.log("booking", booking);
  res.json({ status: "success", data: booking });
});

//admin verifies documents
exports.verifyDocuments = catchAsync(async (req, res, next) => {
  const { status, insuranceVerified, driverLicenseVerified } = req.body;
  const { bookingId } = req.params;
  console.log(status, insuranceVerified, driverLicenseVerified, bookingId);
  const session = await Booking.startSession(); // start session
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId)
      .populate("driverLicenses insurance")
      .session(session); // attach session

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!booking.driverLicenses || !booking.insurance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Both driver license and insurance must be uploaded",
      });
    }

    // Update DriverLicense
    const driverUpdate = await DriverLicense.findByIdAndUpdate(
      booking.driverLicenses._id,
      { verified: driverLicenseVerified || true },
      { new: true, session }
    );

    // Update Insurance
    const insuranceUpdate = await Insurance.findByIdAndUpdate(
      booking.insurance._id,
      { insuranceVerified: insuranceVerified || true },
      { new: true, session }
    );
    console.log("Insurance Update:", insuranceUpdate);

    if (!driverUpdate || !insuranceUpdate) {
      // If any update failed, abort transaction
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        message: "Failed to verify documents, transaction cancelled",
      });
    }

    // Update booking

    booking.status = status || "payment_pending";

    await booking.save({ session });

    await session.commitTransaction(); // commit transaction
    session.endSession();
    console.log("booking", booking);
    res.status(200).json({
      message:
        "Documents verified and booking status updated to payment_pending",
      data: booking,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});
// ✅ Update booking (admin only)
exports.updateBooking = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;
  const updates = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // Update allowed fields
  if (updates.status) booking.status = updates.status;

  if (updates.insurance) {
    booking.insurance.provider =
      updates.insurance.provider ?? booking.insurance.provider;
    booking.insurance.policyNumber =
      updates.insurance.policyNumber ?? booking.insurance.policyNumber;
    if (typeof updates.insurance.verified === "boolean") {
      booking.insurance.verified = updates.insurance.verified;
    }
  }

  if (updates.driverLicense) {
    booking.driverLicense.number =
      updates.driverLicense.number ?? booking.driverLicense.number;
    booking.driverLicense.state =
      updates.driverLicense.state ?? booking.driverLicense.state;
    booking.driverLicense.documentUrl =
      updates.driverLicense.documentUrl ?? booking.driverLicense.documentUrl;
    if (typeof updates.driverLicense.verified === "boolean") {
      booking.driverLicense.verified = updates.driverLicense.verified;
    }
  }

  await booking.save();

  res.status(200).json({
    status: "success",
    data: booking,
  });
});
exports.getAllBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find()
    .populate("user") // populate user details
    .populate("car")
    .populate("driver");
  // populate car details

  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: bookings,
  });
});
exports.adminUpdateBookingStatus = catchAsync(async (req, res, next) => {
  const { id: bookingId } = req.params;

  const { status } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }
  booking.status = status;
  await booking.save();
  res.status(200).json({
    status: "success",
    data: booking,
  });
});
