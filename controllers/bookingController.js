const { catchAsync } = require("../utils/catchAsync");
const Car = require("../models/carModel");
const AppError = require("../utils/appError");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const Driver = require("../models/driverModel");
const mongoose = require("mongoose");
const { notifyBookingCreated } = require("../services/notificationHelper");
const RentalSession = require("../models/RentalSession");
const emailServices = require("../utils/emailServices");

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

exports.createBooking = catchAsync( async (req, res, next) => {
 
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

  const session = await mongoose.startSession();
  try {
    let driver;
    let hasDriverData = false;
    await session.withTransaction(async () => {
      if (driverId) {
        driver = await Driver.findOne({
          _id: driverId,
          user: req.user._id,
        }).session(session);
        driver;
        if (!driver) throw new AppError("Driver not found", 404);
        hasDriverData = true;
      } else if (licenseImage && insuranceImage) {
        const [newDriver] = await Driver.create(
          [
            {
              name: driverName,
              user: req.user._id,
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
          req.user._id,
          { $push: { drivers: driver._id } },
          { session }
        );
      }
      const status = determineBookingStatus(driver, hasDriverData);

      const [booking] = await Booking.create(
        [
          {
            user: req.user._id,
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
        userId: req.user._id,
        userName: req.user.name || "Customer",
        carName: `${carDoc.name} ${carDoc.model}`,
        bookingId: Booking._id,
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
    console.log("Booking error:", err);
    return next(
      err instanceof AppError
        ? err
        : new AppError("Booking failed. Please try again.", 500)
    );
  } finally {
    session.endSession();
  }
});
exports.getBooking = catchAsync( async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("car", "_id series model images pricePerDay")
    .populate("user", "fullName email phone")
    .populate("driver");
  if (!booking) return new AppError("Booking not Found", 404);
  res.status(200).json({ status: "success", data: booking });
});
exports.addBookingDriver = catchAsync( async (req, res, next) => {
  const { id: bookingId } = req.params;
  console.log(bookingId);

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
      booking.status = "pending_payment";

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
            user: req.user._id,
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

exports.getUserBookings = catchAsync(
 
  async (req, res, next) => {
    const booking = await Booking.find({ user: req.user._id })
      .populate("car", "_id series model images")
      .populate("driver")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: booking.length,
      data: booking,
    });
  }
);

exports.cancelBooking = catchAsync( async (req, res, next) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );
  res.json({ status: "success", data: booking });
});

exports.checkInBooking = catchAsync(
  async (req, res, next) => {
    const { id: bookingId } = req.params;
  
    const {
      checkInTime = new Date(),
      mileage,
      fuelLevel,
      notes,
      checkInImages,
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
    if (booking.status !== "confirmed") {
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
      return next(
        new AppError("Odometer reading is required for check-in", 400)
      );
    }

    if (+fuelLevel === undefined || +fuelLevel === null) {
      return next(new AppError("Fuel level is required for check-in", 400));
    }

    // Validate fuel level (0-100)
    if (+fuelLevel < 0 || +fuelLevel > 100) {
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
    console.log("Current Car Odometer:", booking.car, "Check-in Mileage:", mileage);
    if(mileage < booking.car.currentOdometer){
return next( new AppError("Odometer reading cannot be less than current car odometer", 400));
    }


    // Start a transaction to ensure data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status and check-in information
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          status: "in_progress",
          checkInTime: new Date(checkInTime),
          checkInData: {
            mileage,
            fuelLevel,
            notes: notes || "",
            checkedInBy: req.user?._id,
            checkedInAt: new Date(),
            checkInImages,
          },
          startMileage: mileage,
          $push: {
            statusHistory: {
              type: "check-in",
              status: "active",
              timestamp: new Date(),
              changedBy: req.user?.id,
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
          currentOdometer: mileage,
          lastRented: new Date(),
          $push: {
            rentalHistory: {
              type: "check-in",
              booking: bookingId,
              rentedAt: new Date(),
              odometerAtRental: mileage,
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
            startOdometer: mileage,
            startFuelLevel: fuelLevel,
            status: "active",
            pickupLocation: booking.pickupLocation,
          },
        ],
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();

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
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error("Check-in transaction failed:", error);
      return next(new AppError("Check-in failed. Please try again.", 500));
    } finally {
      session.endSession();
    }
  }
);



exports.checkOutBooking = catchAsync(
  async (req, res, next) => {
    const { id: bookingId } = req.params;

    const {
      checkOutTime = new Date(),
      mileage,
      fuelLevel,
      notes,
      checkOutImages,
      cleaningRequired = false,
      damageNotes,
    } = req.body;

    // Validate required parameters
    if (!bookingId) {
      return next(new AppError("Booking ID is required", 400));
    }

    // Find the booking and populate necessary fields
    const booking = await Booking.findById(bookingId)
      .populate("car")
      .populate("user", "fullName email phone");

    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }

    // Validate booking status - only allow check-out for in_progress/active bookings
    if (!["in_progress", "active"].includes(booking.status)) {
      return next(
        new AppError(
          `Cannot check out booking with status: ${booking.status}. Booking must be in progress.`,
          400
        )
      );
    }

    // Validate required check-out data
    if (!mileage) {
      return next(
        new AppError("Final odometer reading is required for check-out", 400)
      );
    }

    if (+fuelLevel === undefined || +fuelLevel === null) {
      return next(
        new AppError("Final fuel level is required for check-out", 400)
      );
    }

    // Validate fuel level (0-100)
    if (+fuelLevel < 0 || +fuelLevel > 100) {
      return next(new AppError("Fuel level must be between 0 and 100", 400));
    }

    // Validate odometer reading (should be a positive number and not less than check-in mileage)
    const finalMileage = parseInt(mileage);
    const startMileage = booking.startMileage;

    if (finalMileage < 0) {
      return next(
        new AppError("Odometer reading must be a positive number", 400)
      );
    }

    if (startMileage && finalMileage < startMileage) {
      return next(
        new AppError("Final mileage cannot be less than start mileage", 400)
      );
    }


        // Calculate mileage difference and additional charges
   
    const mileageDifference = startMileage ? finalMileage - startMileage : 0;
    const allowedMileage = booking.checkInData.allowedMileage || 200;
    const mileageOverage = Math.max(0, mileageDifference - allowedMileage);
    const mileageCharge = mileageOverage * (booking.mileageRate || 0.5); // Default $0.5 per mile overage
    const cleaningFee = cleaningRequired ? 0 : booking.cleaningFee || 75 ;

      // Assume full tank at check-in = 100%
  const checkInFuelLevel = booking.checkInData?.fuelLevel || 100;
 
  const checkOutFuelLevel = parseFloat(fuelLevel) || 0;


  // Convert difference in % to liters
  const fuelTankCapacity = booking.car?.fuelCapacity; // assume 60L tank if not set
  const fuelDifferencePercent = Math.max(0, checkInFuelLevel - checkOutFuelLevel);
  const fuelDifferenceLiters = (fuelDifferencePercent / 100) * fuelTankCapacity;
  const fuelRatePerLiter = 3.1;
  const fuelCharge = fuelDifferenceLiters * fuelRatePerLiter;
    const totalAdditionalCharges =
     fuelCharge +
      cleaningFee +
      mileageCharge;
      console.log("Total Additional Charges:", totalAdditionalCharges);

    // Start a transaction to ensure data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status and check-out information
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,

        {
          status: "completed",
          checkOutTime: new Date(checkOutTime),
          checkOutData: {
          
            fuelLevel,
            notes: notes || "",
            checkedOutBy: req.user?._id,
            checkedOutAt: new Date(),
            checkOutImages,
            cleaningRequired,
            damageNotes: damageNotes || "",
            mileageDifference,
            endMileage: finalMileage,
            fuelCharge,
            cleaningFee,
            totalAdditionalCharges: parseFloat(totalAdditionalCharges) || 0,
            totalMileageUsed: mileageDifference,
           
          },
          $push: {
            statusHistory: {
              type: "check-out",
              status: "completed",
              timestamp: new Date(),
              changedBy: req.user?.id,
              notes: "Customer check-out completed",
            },
          },
          totalCharges: (booking.totalPrice || 0) + totalAdditionalCharges,
         
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      )
        .populate("car")
        .populate("user", "fullName email phone");

      // Update car status back to 'available' and update current metrics
      await Car.findByIdAndUpdate(
        booking.car._id,
        {
          status: "available",
          currentOdometer: finalMileage,
          fuelLevel: fuelLevel,
          lastMaintenanceCheck: new Date(),
          $push: {
            rentalHistory: {
              type: "check-out",
              booking: bookingId,
              returnedAt: new Date(),
              odometerAtReturn: finalMileage,
              fuelLevelAtReturn: fuelLevel,
            },
          },
        },
        { session }
      );

      // Update the rental session record
      await RentalSession.findOneAndUpdate(
        { booking: bookingId, status: "active" },
        {
          endTime: new Date(checkOutTime),
          endOdometer: finalMileage,
          endFuelLevel: fuelLevel,
          status: "completed",
          returnLocation: booking.returnLocation || booking.pickupLocation,
          additionalCharges: totalAdditionalCharges,
          notes: notes || "",
        },
        { session }
      );

      // ✅ FIXED: UPDATE USER RENTAL STATS - Use direct update instead of save()
      const user = await User.findById(booking.user._id).session(session);
      if (user) {
        const now = new Date();
        
        // Update user rental stats directly using findByIdAndUpdate to avoid parallel save
        await User.findByIdAndUpdate(
          booking.user._id,
          {
            $inc: {
              'rentalStats.totalRentals': 1,
              'loyalty.points': 10
            },
            $set: {
              'rentalStats.lastRentalDate': now,
              ...(!user.rentalStats.firstRentalDate && {
                'rentalStats.firstRentalDate': now
              })
            }
          },
          { session }
        );

        // Update loyalty tier based on new rental count
        const updatedTotalRentals = (user.rentalStats.totalRentals || 0) + 1;
        let newTier = "bronze";
        
        if (updatedTotalRentals >= 20) {
          newTier = "platinum";
        } else if (updatedTotalRentals >= 10) {
          newTier = "gold";
        } else if (updatedTotalRentals >= 5) {
          newTier = "silver";
        }

        if (newTier !== user.loyalty.tier) {
          await User.findByIdAndUpdate(
            booking.user._id,
            { $set: { 'loyalty.tier': newTier } },
            { session }
          );
        }

        // ✅ SEND RENTAL COMPLETION EMAIL (outside transaction)
        try {
         
          // Send email after transaction is committed
          setTimeout(async () => {
            try {
              const updatedUser = await User.findById(booking.user._id);

              await emailServices.sendRentalCompletion({
                customerEmail: updatedUser .email,
                customerName: updatedUser .fullName,
                bookingId: updatedBooking._id,
                vehicleModel: updatedBooking.car.model,
                returnDate: new Date().toLocaleDateString(),
                totalAmount: updatedBooking.totalCharges,
                additionalCharges: totalAdditionalCharges,
                rentalStats: {
                  totalRentals: updatedTotalRentals,
                  loyaltyTier: newTier,
                  loyaltyPoints: (updatedUser .loyalty.points || 0) + 10
                }
              });
            } catch (emailError) {
              console.error('Failed to send rental completion email:', emailError);
            }
          }, 100);
        } catch (emailError) {
          console.error('Failed to schedule rental completion email:', emailError);
        }
      }

      // Commit the transaction
      await session.commitTransaction();

      // Get updated user data for response
      const updatedUser = await User.findById(booking.user._id);

      res.status(200).json({
        status: "success",
        message: "Booking checked out successfully",
        data: {
          booking: {
            id: updatedBooking._id,
            status: updatedBooking.status,
            checkOutTime: updatedBooking.checkOutTime,
            car: {
              model: updatedBooking.car.model,
              licensePlate: updatedBooking.car.licensePlate,
            },
            user: {
              name: updatedBooking.user.fullName,
              email: updatedBooking.user.email,
            },
            checkOutData: updatedBooking.checkOutData,
            totalCharges: updatedBooking.totalCharges,
            additionalCharges: totalAdditionalCharges,
            chargesBreakdown: {
              fuelCharge,
              cleaningFee: cleaningFee,
              mileageCharge: mileageCharge,
              // otherCharges: parseFloat(additionalCharges) || 0,
            },
          },
          // ✅ Include updated user rental stats in response
          userRentalStats: updatedUser ? {
            totalRentals: updatedUser.rentalStats.totalRentals,
            firstRentalDate: updatedUser.rentalStats.firstRentalDate,
            lastRentalDate: updatedUser.rentalStats.lastRentalDate,
            loyaltyTier: updatedUser.loyalty.tier,
            loyaltyPoints: updatedUser.loyalty.points,
            rentalsPerMonth: updatedUser.rentalStats.rentalsPerMonth
          } : null
        },
      });
    } catch (error) {
      // If anything fails, abort the transaction
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error("Check-out transaction failed:", error);
      return next(new AppError("Check-out failed. Please try again.", 500));
    } finally {
      session.endSession();
    }
  }
);
exports.UpdateBookingDriver = catchAsync(
 
  async (req, res, next) => {
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

    const session = await mongoose.startSession();

    try {
      let booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        await session.endSession();
        return next(new AppError("Booking not found", 404));
      }

      // Store original values for comparison
      const originalDriver = booking.driver;
      const originalStatus = booking.status;

      if (pickupDate) booking.pickupDate = pickupDate;
      if (returnDate) booking.returnDate = returnDate;
      if (pickupLocation) booking.pickupLocation = pickupLocation;

      let driver;
      let isNewDriver = false;
      let driverVerified = false;

      await session.withTransaction(async () => {
        if (driverId) {
          // Using existing driver
          driver = await Driver.findById(driverId).session(session);
          if (!driver) {
            throw new AppError("Driver not found", 404);
          }

          driverVerified = driver.verified === true;
          booking.driver = driverId;

          // Update status based on driver verification
          if (driverVerified && booking.status !== "pending_payment") {
            booking.status = "pending_payment";
            console.log(
              `Updated booking status to pending_payment for verified driver: ${driverId}`
            );
          } else if (
            !driverVerified &&
            booking.status !== "verification_pending"
          ) {
            booking.status = "verification_pending";
            console.log(
              `Updated booking status to verification_pending for unverified driver: ${driverId}`
            );
          }
        } else if (licenseImage && insuranceImage) {
          // Creating new driver
          isNewDriver = true;
          const [newDriver] = await Driver.create(
            [
              {
                name: name || `Driver ${Date.now()}`,
                user: req.user._id,
                isDefault: false,
                license: {
                  fileUrl: licenseImage,
                  verified: false,
                  uploadedAt: new Date(),
                },
                insurance: {
                  fileUrl: insuranceImage,
                  verified: false,
                  uploadedAt: new Date(),
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
            { session }
          );

          driver = newDriver;
          driverVerified = false;

          // Add driver to user's drivers array
          await User.findByIdAndUpdate(
            req.user._id,
            {
              $push: { drivers: driver._id },
            },
            { session }
          );

          booking.driver = driver._id;

          // Always set to verification_pending for new drivers
          if (booking.status !== "verification_pending") {
            booking.status = "verification_pending";
            console.log(
              `Updated booking status to verification_pending for new driver: ${driver._id}`
            );
          }
        } else {
          // No driver changes, just update other fields
          await booking.save({ session });
          return; // Exit transaction early since no driver changes
        }

        // Add status history entry if status changed
        if (originalStatus !== booking.status) {
          booking.statusHistory = booking.statusHistory || [];
          booking.statusHistory.push({
            status: booking.status,
            timestamp: new Date(),
            changedBy: req.user._id.toString(),
            notes: isNewDriver
              ? "New driver added - awaiting verification"
              : driverVerified
              ? "Verified driver assigned - pending payment"
              : "Unverified driver assigned - awaiting verification",
          });
        }

        // Add activity log entry for driver update
        booking.activityLog = booking.activityLog || [];
        booking.activityLog.push({
          action: isNewDriver ? "driver_added" : "driver_updated",
          timestamp: new Date(),
          performedBy: req.user._id.toString(),
          details: {
            previousDriver: originalDriver,
            newDriver: driver._id,
            previousStatus: originalStatus,
            newStatus: booking.status,
            driverVerified: driverVerified,
            isNewDriver: isNewDriver,
          },
          ipAddress: req.ip,
        });

        await booking.save({ session });
      });

      await session.endSession();

      // Populate the updated booking
      await booking.populate([
        {
          path: "driver",
          select: "name license insurance verified isDefault createdAt",
        },
        {
          path: "car",
          select: "make model pricePerDay images year licensePlate",
        },
        {
          path: "user",
          select: "name email phone",
        },
      ]);

      // Prepare response message based on what happened
      let message = "Booking updated successfully";
      if (isNewDriver) {
        message =
          "New driver added and booking status updated to verification pending";
      } else if (driverVerified) {
        message =
          "Verified driver assigned and booking status updated to pending payment";
      } else if (driverId) {
        message = "Driver updated - awaiting verification";
      }

      res.status(200).json({
        status: "success",
        message,
        data: {
          booking,
          statusUpdated: originalStatus !== booking.status,
          newStatus: booking.status,
          driverVerified: driverVerified,
          isNewDriver: isNewDriver,
        },
      });
    } catch (error) {
      await session.endSession();
      console.error("Error updating booking driver:", error);
      next(error);
    }
  }
);
exports.getCarBooking = catchAsync( async (req, res, next) => {
  const bookings = await Booking.find({
    car: req.params.id,
    status: { $in: ["confirmed", "active", "in_progress", "checked_in"] },
  })
    .populate("user", "name email phone")
    .populate("car", "model make images pricePerDay")
    .select("pickupDate returnDate pickupTime returnTime status totalPrice");

  if (!bookings) {
    return next(new AppError("bookings not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: bookings,
  });
});
