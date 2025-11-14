const { catchAsync } = require("../utils/catchAsync");
const Car = require("../models/carModel");
const AppError = require("../utils/appError");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const Driver = require("../models/driverModel");
const mongoose = require("mongoose");
const { notifyBookingCreated } = require("../services/notificationHelper");
// const RentalSession = require("../models/RentalSession");
const emailServices = require("../utils/emailServices");
const moment = require("moment-timezone");
const { logActivityWithSocket } = require("../utils/activityLogger");

const calculateBookingDetails = (pickupDate, returnDate, pricePerDay) => {
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
  const depositAmount = 150; // this amount will be refund after check-out, if there is no damage or exrtra fee

  if (isNaN(days) || days <= 0) {
    throw new AppError("Return date must be after pickup date", 400);
  }

  const basePrice = days * pricePerDay;
  // const taxAmount = basePrice * 0.08; // 8% tax
  const totalPrice = basePrice + depositAmount;

  return { days, basePrice, totalPrice, depositAmount };
};

// Calculate hourly booking details
const calculateHourlyBookingDetails = (startTime, endTime, hourlyRate) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = Math.ceil((end - start) / (1000 * 60 * 60)); // Round up to nearest hour
  const depositAmount = 50; // Lower deposit for hourly bookings

  if (isNaN(hours) || hours <= 0) {
    throw new AppError("End time must be after start time", 400);
  }

  if (hours > 24) {
    throw new AppError("Hourly bookings cannot exceed 24 hours. Please use daily booking instead.", 400);
  }

  const basePrice = hours * hourlyRate;
  const totalPrice = basePrice + depositAmount;

  return { hours, basePrice, totalPrice, depositAmount, hourlyRate };
};

// Helper function to determine booking status based on driver verification
const determineBookingStatus = (driver, hasDriverData = false) => {
  if (!hasDriverData) return "license_required";
  if (driver?.verified === true) return "pending_payment";
  return "verification_pending";
};


exports.createBooking = catchAsync(async (req, res, next) => {
  const currentTimeInStLouis = moment.tz(new Date(), "America/Chicago");

  const {
    car,
    pickupDate,
    returnDate,
    pickupLocation,
    driverId,
    professionalDriverId,
    pickupTime,
    returnTime,
    licenseImage,
    insuranceImage,
    driverName,
    acceptedTerm,
    requestDriver, // New: Request real-time driver assignment
  } = req.body;

  // ✅ Mutually exclusive driver validation
  if (professionalDriverId && (driverId || licenseImage || insuranceImage)) {
    return next(
      new AppError(
        "Cannot provide both a professional driver and a personal driver/driver info.",
        400
      )
    );
  }

  // ✅ Require at least one driver type OR requestDriver
  if (!requestDriver && !professionalDriverId && !driverId && !(licenseImage && insuranceImage)) {
    return next(
      new AppError(
        "You must provide either a professional driver, your own driver information, or request a driver.",
        400
      )
    );
  }

  // ✅ If requestDriver is true, cannot provide other driver options
  if (requestDriver && (professionalDriverId || driverId || licenseImage || insuranceImage)) {
    return next(
      new AppError(
        "Cannot request driver and provide driver information at the same time.",
        400
      )
    );
  }

  // 🕓 Parse times safely
  let pickupTimeParsed = pickupTime || "10:00 AM";
  let returnTimeParsed = returnTime || "10:00 AM";

  if (pickupTimeParsed.includes("AM") || pickupTimeParsed.includes("PM")) {
    pickupTimeParsed = moment(pickupTimeParsed, "h:mm A").format("HH:mm");
  }
  if (returnTimeParsed.includes("AM") || returnTimeParsed.includes("PM")) {
    returnTimeParsed = moment(returnTimeParsed, "h:mm A").format("HH:mm");
  }

  const pickupDateTime = moment.tz(
    `${pickupDate} ${pickupTimeParsed}`,
    "YYYY-MM-DD HH:mm",
    "America/Chicago"
  );
  const returnDateTime = moment.tz(
    `${returnDate} ${returnTimeParsed}`,
    "YYYY-MM-DD HH:mm",
    "America/Chicago"
  );

  if (!pickupDateTime.isValid() || !returnDateTime.isValid()) {
    return next(new AppError("Invalid pickup or return date/time format.", 400));
  }

  if (pickupDateTime.isBefore(currentTimeInStLouis)) {
    return next(
      new AppError(
        "Pickup time cannot be in the past (based on St. Louis local time).",
        400
      )
    );
  }

  if (!returnDateTime.isAfter(pickupDateTime)) {
    return next(
      new AppError("Return time must be after pickup time.", 400)
    );
  }

  // 🚗 Validate car availability
  const carDoc = await Car.findById(car);
  if (!carDoc) return next(new AppError("Car not found.", 404));
  if (carDoc.status !== "available") {
    return next(new AppError("Car is not available.", 400));
  }

  const { days, basePrice, depositAmount, totalPrice } =
    calculateBookingDetails(pickupDate, returnDate, carDoc.pricePerDay);

  const session = await mongoose.startSession();
  let createdBooking;

  try {
    await session.withTransaction(async () => {
      let driver;
      let professionalDriver = null;
      let driverServiceTotal = 0;
      let hasDriverData = false;

      // 👨‍✈️ Professional driver flow
      if (professionalDriverId) {
        // Use unified Driver model (professional drivers are stored there)
        professionalDriver = await Driver.findById(professionalDriverId)
          .session(session);

        if (
          !professionalDriver ||
          professionalDriver.driverType !== "professional" ||
          professionalDriver.status !== "active" ||
          !professionalDriver.verified
        ) {
          throw new AppError("Professional driver is not available.", 400);
        }

        // Calculate hours from pickup to return
        const hours = Math.ceil((returnDateTime - pickupDateTime) / (1000 * 60 * 60));
        if (hours <= 0) {
          throw new AppError("Invalid time duration for driver service.", 400);
        }

        // Professional driver rate: $35/hour (fixed rate)
        const HOURLY_RATE = 35;
        driverServiceTotal = hours * HOURLY_RATE;
        hasDriverData = true;
      }

      // 🚗 Customer-provided driver flow
      if (driverId) {
        driver = await Driver.findOne({
          _id: driverId,
          user: req.user._id,
        }).session(session);

        if (!driver) throw new AppError("Driver not found.", 404);
        hasDriverData = true;
      } else if (licenseImage && insuranceImage) {
        const [newDriver] = await Driver.create(
          [
            {
              name: driverName,
              user: req.user._id,
              isDefault: true,
              driverType: "rental", // Rental driver added from booking form
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

      // 🧾 Determine booking status
      let status;
      if (requestDriver) {
        status = "pending"; // Will change to pending_payment when driver accepts
      } else if (professionalDriver) {
        status = "pending_payment";
      } else {
        status = determineBookingStatus(driver, hasDriverData);
      }

      // 🧠 Create booking
      [createdBooking] = await Booking.create(
        [
          {
            user: req.user._id,
            driver: driver ? driver._id : undefined,
            professionalDriver: professionalDriver
              ? professionalDriver._id
              : undefined,
            car: carDoc._id,
            pickupDate,
            returnDate,
            pickupTime,
            returnTime,
            rentalDays: days,
            pickupLocation,
            returnLocation: pickupLocation,
            acceptedTerm,
            basePrice,
            depositAmount,
            driverServiceTotal,
            driverServiceFee: driverServiceTotal,
            totalPrice: totalPrice + driverServiceTotal,
            startMileage: carDoc.currentOdometer,
            status,
            rentalTerms: {
              agreementSigned: acceptedTerm,
              mileageLimit: 200,
              fuelPolicy: "full-to-full",
              lateReturnFee: 0.5,
              cleaningFee: 75,
              damageDeposit: 500,
            },
            // ✅ Phase 2: Real-time Professional Driver Flow
            requestDriver: requestDriver || false,
            driverRequestStatus: requestDriver ? "pending" : null,
            requestedAt: requestDriver ? new Date() : null,
            driverAssigned: requestDriver ? false : undefined, // Driver not yet assigned for real-time requests
            statusHistory: [
              {
                status,
                timestamp: new Date(),
                changedBy: req.user._id,
                notes: requestDriver ? "Booking created - driver requested" : "Booking created",
              },
            ],
          },
        ],
        { session }
      );

      // 🔔 Send notification
      await notifyBookingCreated({
        userId: req.user._id,
        userName: req.user.name || "Customer",
        carName: `${carDoc.name} ${carDoc.model}`,
        bookingId: createdBooking._id,
        carId: carDoc._id,
        totalPrice: totalPrice + driverServiceTotal,
      });
    });

    // Check if booking was created successfully
    if (!createdBooking) {
      throw new AppError("Failed to create booking. Please try again.", 500);
    }

    // Log activity (after transaction commits)
    await logActivityWithSocket(
      req,
      "Booking Created",
      {
        bookingId: createdBooking._id,
        carId: carDoc._id,
        status,
        requestDriver,
      },
      { userId: req.user._id, role: req.user.role }
    );

    // 🧩 Populate relations after transaction commits
    await createdBooking.populate([
      { path: "user", select: "fullName email phone" },
      { path: "driver", options: { strictPopulate: false } },
      {
        path: "professionalDriver",
        select:
          "name email phone rating hourlyRate fullName",
        options: { strictPopulate: false },
      },
      {
        path: "car",
        select:
          "name model series year pricePerDay images currentOdometer status",
      },
    ]);

    // Note: Driver request will be emitted after payment is completed (in webhook handler)
    // This ensures drivers only receive requests for paid bookings

    // ✅ Respond to client
    res.status(201).json({
      status: "success",
      message: requestDriver
        ? "Booking created. Waiting for driver assignment..."
        : "Booking created successfully",
      data: createdBooking.toObject({ getters: true }),
    });
  } catch (err) {
    console.error("Booking error:", err);
    console.error("Booking error stack:", err.stack);
    console.error("Booking error details:", {
      message: err.message,
      name: err.name,
      code: err.code,
    });
    
    // If it's already an AppError, pass it through
    if (err instanceof AppError) {
      return next(err);
    }
    
    // For database errors, provide more specific messages
    if (err.name === "ValidationError") {
      return next(new AppError(`Validation error: ${err.message}`, 400));
    }
    
    if (err.name === "MongoServerError" || err.code === 11000) {
      return next(new AppError("A booking with this information already exists.", 400));
    }
    
    // For other errors, include the actual error message if it's helpful
    const errorMessage = err.message || "Booking failed. Please try again.";
    return next(new AppError(errorMessage, 500));
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

exports.getBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("car", "_id series model images pricePerDay")
    .populate("user", "fullName email phone")
    .populate("driver", "name verified license insurance") // MEMORY OPTIMIZATION: Select only needed fields
    .populate({
      path: "professionalDriver",
      select: "name email phone rating hourlyRate fullName verified status"
    })
    .lean(); // Use lean() to reduce memory usage

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  res.status(200).json({ status: "success", data: booking });
});

exports.getAllBooking = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const {
    sort = "-createdAt",
    fields,
    status,
    user,
    car,
    from,
    to,
    include = "user,car,driver"
  } = req.query;

  // Build MongoDB filter
  const filter = {};
  if (status) filter.status = { $in: String(status).split(",") };
  if (user) filter.user = user;
  if (car) filter.car = car;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  // Build query modifier for populate, select, and sort
  const queryModifier = (query) => {
    // Field limiting (select specific fields)
    if (fields) {
      const projection = String(fields).split(",").join(" ");
      query = query.select(projection);
    }

    // Populate relations (user, car, driver, etc.)
    const populateFields = String(include)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    populateFields.forEach((p) => {
      if (p === "user") query = query.populate("user", "fullName email phone");
      if (p === "car") query = query.populate("car", "model series licensePlate images pricePerDay");
      if (p === "driver") query = query.populate("driver", "name verified");
    });

    // Sorting
    if (sort) {
      const sortBy = String(sort).split(",").join(" ");
      query = query.sort(sortBy);
    }

    return query;
  };

  // Execute paginated query
  const { data: bookings, pagination } = await paginateQuery(Booking, filter, req, {
    queryModifier,
    defaultLimit: 20,
    maxLimit: 100,
  });

  if (!bookings || bookings.length === 0) {
    return next(new AppError("No bookings found", 404));
  }

  res.status(200).json({
    status: "success",
    ...pagination,
    data: bookings
  });
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
            driverType: "rental", // Rental driver added from booking details
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

      // MEMORY OPTIMIZATION: Populate only needed driver fields
      await booking.populate("driver", "name verified license insurance");

      res.status(200).json({
        status: "success",
        data: booking,
      });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    next(err);
  }
});

exports.getUserBookings = catchAsync(
 
  async (req, res, next) => {
    const booking = await Booking.find({ user: req.user._id })
      .populate("car", "_id series model images")
      .populate("driver", "name verified") // MEMORY OPTIMIZATION: Select only needed fields
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: booking.length,
      data: booking,
    });
  }
);

exports.cancelBooking = catchAsync( async (req, res, next) => {
  // MEMORY OPTIMIZATION: Select only needed fields for populate
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  ).populate("acceptedDriver", "name verified").populate("professionalDriver", "name email phone rating");
  
  // Update driver status back to "available" if booking had a driver
  if (booking && (booking.acceptedDriver || booking.professionalDriver)) {
    try {
      const driverId = booking.acceptedDriver?._id || booking.professionalDriver?._id;
      if (driverId) {
        const driver = await Driver.findById(driverId);
        if (driver && driver.driverType === "professional") {
          driver.currentStatus = "available";
          driver.lastActiveAt = new Date();
          await driver.save({ validateBeforeSave: false });
          console.log(`✅ Driver ${driverId} set back to available after booking cancellation`);
        }
      }
    } catch (driverError) {
      console.error("❌ Error updating driver status on booking cancellation:", driverError);
    }
  }
  
  // Log activity
  await logActivityWithSocket(
    req,
    "Booking Cancelled",
    {
      bookingId: booking._id,
      previousStatus: booking.status,
    },
    { userId: req.user._id, role: req.user.role }
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
      checkinImages
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
           checkInImages:checkinImages
            
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

      // Update driver status back to "available" if booking had a professional driver
      if (booking.acceptedDriver || booking.professionalDriver) {
        try {
          const driverId = booking.acceptedDriver?._id || booking.professionalDriver?._id;
          if (driverId) {
            const driver = await Driver.findById(driverId);
            if (driver && driver.driverType === "professional") {
              driver.currentStatus = "available";
              driver.lastActiveAt = new Date();
              await driver.save({ validateBeforeSave: false, session });
              console.log(`✅ Driver ${driverId} set back to available after booking completion`);
            }
          }
        } catch (driverError) {
          console.error("❌ Error updating driver status on booking completion:", driverError);
          // Don't fail the checkout if driver update fails
        }
      }

     

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
        // Use setImmediate instead of setTimeout for better memory management
        // This ensures the email is sent asynchronously without creating a timer that needs cleanup
        setImmediate(async () => {
          try {
            const updatedUser = await User.findById(booking.user._id).lean();

            await emailServices.sendRentalCompletion({
              customerEmail: updatedUser.email,
              customerName: updatedUser.fullName,
              bookingId: updatedBooking._id,
              vehicleModel: updatedBooking.car.model,
              returnDate: new Date().toLocaleDateString(),
              totalAmount: updatedBooking.totalCharges,
              additionalCharges: totalAdditionalCharges,
              rentalStats: {
                totalRentals: updatedTotalRentals,
                loyaltyTier: newTier,
                loyaltyPoints: (updatedUser.loyalty?.points || 0) + 10
              }
            });
          } catch (emailError) {
            console.error('Failed to send rental completion email:', emailError);
            // Don't throw - email failures shouldn't break checkout
          }
        });
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
                driverType: "rental", // Rental driver added from booking details
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
/**
 * Accept driver request (first driver wins)
 * POST /api/v1/bookings/:id/accept-driver
 */
exports.acceptDriverRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id; // Driver's user ID

  // Get driver profile (check both unified Driver model and DriverProfile)
  const DriverProfile = require("../models/driverProfileModel");
  let driverProfile = null;
  let driverId = null;

  // First, try to find unified Driver model (for professional drivers created during signup)
  const user = await User.findById(userId).select("driver").lean();
  
  if (user?.driver) {
    const unifiedDriver = await Driver.findById(user.driver).lean();
    if (unifiedDriver && unifiedDriver.driverType === "professional") {
      driverProfile = unifiedDriver;
      driverId = unifiedDriver._id.toString();
    }
  }

  // If not found in unified Driver, check DriverProfile (legacy support)
  if (!driverProfile) {
    const profileDoc = await DriverProfile.findOne({ user: userId });
    if (profileDoc) {
      driverProfile = profileDoc;
      driverId = profileDoc._id.toString();
    }
  }

  if (!driverProfile || !driverId) {
    return next(new AppError("Driver profile not found. Please complete driver registration.", 404));
  }

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // Check if booking is still pending driver assignment
  if (booking.driverRequestStatus !== "pending") {
    return next(
      new AppError(
        booking.driverRequestStatus === "accepted"
          ? "Driver already assigned to this booking"
          : "This booking is no longer accepting driver requests",
        400
      )
    );
  }

  // Check if request has expired (5 minutes)
  if (booking.requestedAt) {
    const requestAge = Date.now() - new Date(booking.requestedAt).getTime();
    const EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

    if (requestAge > EXPIRY_TIME) {
      booking.driverRequestStatus = "expired";
      await booking.save({ validateBeforeSave: false });

      // Notify user that request expired
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${booking.user._id}`).emit("driver_request_expired", {
          bookingId: booking._id,
        });
      }

      return next(new AppError("Driver request has expired", 400));
    }
  }

  // Use transaction to ensure only first driver wins
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Re-check status in transaction
      const currentBooking = await Booking.findById(id).session(session);
      if (currentBooking.driverRequestStatus !== "pending") {
        throw new AppError("Another driver already accepted this request", 409);
      }

      // Calculate driver service fee: $35/hour
      const HOURLY_RATE = 35;
      
      // Parse pickup and return times
      let pickupTimeParsed = currentBooking.pickupTime || "10:00 AM";
      let returnTimeParsed = currentBooking.returnTime || "10:00 AM";
      
      if (pickupTimeParsed.includes("AM") || pickupTimeParsed.includes("PM")) {
        pickupTimeParsed = moment(pickupTimeParsed, "h:mm A").format("HH:mm");
      }
      if (returnTimeParsed.includes("AM") || returnTimeParsed.includes("PM")) {
        returnTimeParsed = moment(returnTimeParsed, "h:mm A").format("HH:mm");
      }
      
      const pickupDateTime = moment.tz(
        `${moment(currentBooking.pickupDate).format("YYYY-MM-DD")} ${pickupTimeParsed}`,
        "YYYY-MM-DD HH:mm",
        "America/Chicago"
      );
      const returnDateTime = moment.tz(
        `${moment(currentBooking.returnDate).format("YYYY-MM-DD")} ${returnTimeParsed}`,
        "YYYY-MM-DD HH:mm",
        "America/Chicago"
      );
      
      const hours = Math.ceil((returnDateTime - pickupDateTime) / (1000 * 60 * 60));
      const driverServiceFee = hours > 0 ? hours * HOURLY_RATE : 0;

      // Assign driver ID (works for both Driver and DriverProfile models)
      // Note: acceptedDriver field references DriverProfile, but we can store Driver ID as well
      // The ID will work for lookups even if the model reference doesn't match exactly
      currentBooking.acceptedDriver = driverId;
      currentBooking.driverRequestStatus = "accepted";
      currentBooking.driverAssigned = true;
      currentBooking.driverServiceFee = driverServiceFee;
      // Update total price to include driver service fee
      currentBooking.totalPrice = (currentBooking.basePrice || 0) + (currentBooking.depositAmount || 150) + driverServiceFee;
      currentBooking.status = "pending_payment";
      
      // Get driver name for status history
      const driverName = driverProfile.fullName || driverProfile.name || driverProfile.user?.fullName || "Driver";
      
      currentBooking.statusHistory.push({
        status: "pending_payment",
        timestamp: new Date(),
        changedBy: driverId,
        notes: `Driver ${driverName} accepted booking request. Service fee: $${driverServiceFee.toFixed(2)} (${hours} hours @ $${HOURLY_RATE}/hour)`,
      });

      await currentBooking.save({ session });

      // Update driver availability status to "on-trip"
      try {
        const driver = await Driver.findById(driverId);
        if (driver && driver.driverType === "professional") {
          driver.currentStatus = "on-trip";
          driver.lastAcceptedBooking = currentBooking._id;
          driver.lastActiveAt = new Date();
          await driver.save({ validateBeforeSave: false });
          console.log(`✅ Driver ${driverId} set to on-trip after accepting booking ${currentBooking._id}`);
        }
      } catch (driverUpdateError) {
        console.error("❌ Error updating driver status on booking acceptance:", driverUpdateError);
        // Don't fail the booking acceptance if driver update fails
      }

      // Emit events
      const io = req.app.get("io");
      if (io) {
        // Notify user
        const driverName = driverProfile.fullName || driverProfile.name || driverProfile.user?.fullName || "Driver";
        io.to(`user:${booking.user._id}`).emit("driver_assigned", {
          bookingId: booking._id,
          driver: {
            name: driverName,
            id: driverId,
          },
        });

        // Notify accepting driver
        io.to(`driver:${driverId}`).emit("driver:accepted", {
          bookingId: booking._id,
          message: "Booking request accepted successfully",
        });

        // Notify other drivers that request was taken
        io.to("drivers").emit("driver:closed", {
          bookingId: booking._id,
          reason: "accepted_by_another",
        });
      }
    });

    // Refresh booking data
    await booking.populate([
      { path: "user", select: "fullName email phone" },
      { path: "car", select: "model series images" },
      { 
        path: "acceptedDriver",
        select: "status rating",
        populate: {
          path: "user",
          select: "fullName email phone"
        }
      },
    ]);

    res.status(200).json({
      status: "success",
      message: "Driver request accepted successfully",
      data: {
        booking: booking.toObject({ getters: true }),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError("Failed to accept driver request", 500));
  } finally {
    session.endSession();
  }
});

/**
 * Get booking reminders
 * GET /api/v1/bookings/reminders
 */
exports.getBookingReminders = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Get user settings to check if reminders are enabled
  const User = require("../models/userModel");
  const user = await User.findById(userId).select("settings");

  if (!user?.settings?.bookingReminders) {
    return res.status(200).json({
      status: "success",
      data: {
        reminders: [],
        message: "Booking reminders are disabled",
      },
    });
  }

  // Get upcoming bookings (within next 7 days)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingBookings = await Booking.find({
    user: userId,
    pickupDate: { $gte: now, $lte: sevenDaysFromNow },
    status: { $in: ["confirmed", "pending_payment"] },
  })
    .populate("car", "model series images")
    .select("pickupDate returnDate pickupTime pickupLocation car status")
    .sort({ pickupDate: 1 });

  const reminders = upcomingBookings.map((booking) => ({
    bookingId: booking._id,
    car: booking.car,
    pickupDate: booking.pickupDate,
    pickupTime: booking.pickupTime,
    pickupLocation: booking.pickupLocation,
    daysUntil: Math.ceil(
      (booking.pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  res.status(200).json({
    status: "success",
    data: {
      reminders,
    },
  });
});

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

/**
 * Create hourly booking
 * POST /api/v1/bookings/hourly
 * Creates a booking based on hourly rate
 */
exports.createHourlyBooking = catchAsync(async (req, res, next) => {
  const currentTime = new Date();
  const {
    car,
    startTime,
    endTime,
    pickupLocation,
  } = req.body;

  // Validate required fields
  if (!car || !startTime || !endTime) {
    return next(new AppError("Car, startTime, and endTime are required", 400));
  }

  // Parse times
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid start or end time format", 400));
  }

  if (start < currentTime) {
    return next(new AppError("Start time cannot be in the past", 400));
  }

  if (end <= start) {
    return next(new AppError("End time must be after start time", 400));
  }

  // Validate car
  const carDoc = await Car.findById(car);
  if (!carDoc) {
    return next(new AppError("Car not found", 404));
  }

  if (carDoc.availability !== "available") {
    return next(new AppError("Car is not available", 400));
  }

  if (!carDoc.hourlyRate) {
    return next(new AppError("This car does not support hourly bookings", 400));
  }

  // Calculate booking details
  const { hours, basePrice, depositAmount, totalPrice, hourlyRate } =
    calculateHourlyBookingDetails(start, end, carDoc.hourlyRate);

  // Check for conflicting bookings
  const conflictingBooking = await Booking.findOne({
    car,
    bookingType: "hourly",
    status: { $in: ["confirmed", "active", "pending", "pending_payment"] },
    $or: [
      {
        startTime: { $lt: end },
        endTime: { $gt: start },
      },
    ],
  });

  if (conflictingBooking) {
    return next(new AppError("Car is already booked for this time period", 400));
  }

  // Create booking
  const booking = await Booking.create({
    user: req.user._id,
    car,
    bookingType: "hourly",
    startTime: start,
    endTime: end,
    hours,
    hourlyRate,
    basePrice,
    totalPrice,
    depositAmount,
    pickupLocation: pickupLocation || "St. Louis",
    returnLocation: pickupLocation || "St. Louis",
    status: "pending_payment",
    paymentStatus: "unpaid",
  });

  // Update car availability
  carDoc.availability = "booked";
  await carDoc.save();

  // Populate for response
  await booking.populate("car", "title brand model images hourlyRate");
  await booking.populate("user", "fullName email phone");

  res.status(201).json({
    status: "success",
    data: booking,
  });
});
