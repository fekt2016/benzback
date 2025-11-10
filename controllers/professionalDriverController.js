const { catchAsync } = require("../utils/catchAsync");
const Driver = require("../models/driverModel");
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
const moment = require("moment-timezone");

/**
 * Get all professional drivers (Public route)
 * Filter by availability status
 * Only returns active drivers (status != "suspended")
 */
exports.getAllProfessionalDrivers = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const { status, available } = req.query;
  
  // Query professional drivers only
  const filter = { driverType: "professional" };
  
  // Only return non-suspended drivers by default
  if (!status) {
    filter.status = { $ne: "suspended" };
  } else {
    filter.status = status;
  }
  
  if (available === "true") {
    filter.status = "available";
    filter.verified = true;
  }
  
  const { data: drivers, pagination } = await paginateQuery(Driver, filter, req, {
    queryModifier: (query) => query.sort({ createdAt: -1 }),
    defaultLimit: 20,
    maxLimit: 100,
  });
  
  res.status(200).json({
    status: "success",
    ...pagination,
    data: drivers,
  });
});

/**
 * Get all professional drivers (Admin only)
 * Returns all drivers including inactive ones
 * Supports filtering and pagination
 */
exports.getAdminProfessionalDrivers = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const { status, verified, active, search } = req.query;
  
  // Build filter
  const filter = { driverType: "professional" };
  
  // Filter by verification
  if (verified !== undefined) {
    filter.verified = verified === "true" || verified === true;
  }
  
  // Filter by active status (map to status field)
  // active=true means status != "suspended", active=false means status == "suspended"
  // Note: active filter takes precedence over status filter if both are provided
  if (active !== undefined) {
    if (active === "true" || active === true) {
      filter.status = { $ne: "suspended" };
    } else {
      filter.status = "suspended";
    }
  } else if (status) {
    // Only apply status filter if active filter is not provided
    filter.status = status;
  }
  
  // Search by fullName, name, email, phone, or license number
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } }, // For rental drivers
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { licenseNumber: { $regex: search, $options: "i" } },
      { "license.number": { $regex: search, $options: "i" } }, // Nested license number
    ];
  }
  
  const { data: drivers, pagination } = await paginateQuery(Driver, filter, req, {
    queryModifier: (query) => query.sort({ createdAt: -1 }),
    defaultLimit: 50,
    maxLimit: 100,
  });
  
  res.status(200).json({
    status: "success",
    ...pagination,
    data: drivers,
  });
});

/**
 * Get available professional drivers for a specific date/time range
 */
exports.getAvailableDrivers = catchAsync(async (req, res, next) => {
  const { pickupDate, returnDate, pickupTime, returnTime } = req.query;
  
  if (!pickupDate || !returnDate) {
    return next(new AppError("Pickup date and return date are required", 400));
  }
  
  // Find professional drivers who are available and verified
  const availableDrivers = await Driver.find({
    driverType: "professional",
    status: "available",
    verified: true,
  });
  
  // Get bookings that overlap with the requested time period
  // Parse time - handle both "HH:mm" and "HH:mm AM/PM" formats
  let pickupTimeParsed = pickupTime || "10:00 AM";
  let returnTimeParsed = returnTime || "10:00 AM";
  
  // Convert "10:00 AM" format to "HH:mm" if needed
  if (pickupTimeParsed.includes("AM") || pickupTimeParsed.includes("PM")) {
    pickupTimeParsed = moment(pickupTimeParsed, "h:mm A").format("HH:mm");
  }
  if (returnTimeParsed.includes("AM") || returnTimeParsed.includes("PM")) {
    returnTimeParsed = moment(returnTimeParsed, "h:mm A").format("HH:mm");
  }
  
  const pickupDateTime = moment.tz(`${pickupDate} ${pickupTimeParsed}`, "YYYY-MM-DD HH:mm", "America/Chicago");
  const returnDateTime = moment.tz(`${returnDate} ${returnTimeParsed}`, "YYYY-MM-DD HH:mm", "America/Chicago");
  
  if (!pickupDateTime.isValid() || !returnDateTime.isValid()) {
    return next(new AppError("Invalid date or time format", 400));
  }
  
  const conflictingBookings = await Booking.find({
    professionalDriverId: { $in: availableDrivers.map(d => d._id) },
    status: { $in: ["pending", "confirmed", "active", "in_progress", "pending_payment"] },
    $or: [
      {
        pickupDate: { $lte: returnDateTime.toDate() },
        returnDate: { $gte: pickupDateTime.toDate() },
      },
    ],
  }).select("professionalDriverId");

  const busyDriverIds = new Set(
    conflictingBookings.map(b => b.professionalDriverId?.toString()).filter(Boolean)
  );
  
  // Filter out busy drivers
  const trulyAvailableDrivers = availableDrivers.filter(
    driver => !busyDriverIds.has(driver._id.toString())
  );
  
  res.status(200).json({
    status: "success",
    results: trulyAvailableDrivers.length,
    data: trulyAvailableDrivers,
  });
});

/**
 * Get professional driver by ID
 */
exports.getProfessionalDriverById = catchAsync(async (req, res, next) => {
  const driver = await Driver.findOne({ _id: req.params.id, driverType: "professional" })
    .populate({ path: "updateHistory.updatedBy", select: "fullName email" })
    .populate("user", "fullName email phone");
  
  if (!driver) {
    return next(new AppError("Professional driver not found", 404));
  }
  
  res.status(200).json({
    status: "success",
    data: driver,
  });
});

/**
 * Create professional driver (Admin only)
 */
exports.createProfessionalDriver = catchAsync(async (req, res, next) => {
  // Ensure driverType is always "professional" (cannot be overridden)
  const { driverType, ...restBody } = req.body;
  
  const driver = await Driver.create({
    driverType: "professional", // Company-provided professional driver (chauffeur)
    ...restBody,
  });
  
  res.status(201).json({
    status: "success",
    data: driver,
  });
});

/**
 * Update professional driver (Admin only)
 */
exports.updateProfessionalDriver = catchAsync(async (req, res, next) => {
  // Ensure driverType cannot be changed
  const { driverType, ...updateData } = req.body;
  
  // Get the current driver to track changes
  const currentDriver = await Driver.findOne({ _id: req.params.id, driverType: "professional" }).lean();
  
  if (!currentDriver) {
    return next(new AppError("Professional driver not found", 404));
  }
  
  // Track changes for update history
  const changes = {};
  const fieldsToTrack = ['fullName', 'email', 'phone', 'dateOfBirth', 'licenseNumber', 'hourlyRate', 'status', 'verified'];
  
  fieldsToTrack.forEach(field => {
    if (updateData[field] !== undefined && updateData[field] !== currentDriver[field]) {
      changes[field] = {
        from: currentDriver[field],
        to: updateData[field],
      };
    }
  });
  
  // Track nested license changes
  if (updateData.license) {
    Object.keys(updateData.license).forEach(key => {
      const currentValue = currentDriver.license?.[key];
      const newValue = updateData.license[key];
      if (newValue !== undefined && newValue !== currentValue) {
        if (!changes.license) changes.license = {};
        changes.license[key] = {
          from: currentValue,
          to: newValue,
        };
      }
    });
  }
  
  // Build the update payload with $set and $push operations
  const updatePayload = { $set: updateData };
  
  // Add update history entry if there are changes
  if (Object.keys(changes).length > 0 && req.user?._id) {
    updatePayload.$push = {
      updateHistory: {
        updatedBy: req.user._id,
        updatedAt: new Date(),
        changes: changes,
        notes: `Updated by admin: ${req.user.fullName || req.user.email || 'Admin'}`,
      },
    };
  }
  
  const driver = await Driver.findOneAndUpdate(
    { _id: req.params.id, driverType: "professional" },
    updatePayload,
    {
      new: true,
      runValidators: true,
    }
  )
    .populate({ path: "updateHistory.updatedBy", select: "fullName email" })
    .populate("user", "fullName email phone");
  
  if (!driver) {
    return next(new AppError("Professional driver not found", 404));
  }
  
  res.status(200).json({
    status: "success",
    data: driver,
  });
});

/**
 * Delete professional driver (Admin only)
 */
exports.deleteProfessionalDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findOneAndUpdate(
    { _id: req.params.id, driverType: "professional" },
    { status: "suspended" }, // Deactivate by setting status to suspended
    { new: true }
  );
  
  if (!driver) {
    return next(new AppError("Professional driver not found", 404));
  }
  
  res.status(200).json({
    status: "success",
    message: "Professional driver deactivated successfully",
  });
});

