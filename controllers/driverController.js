const { catchAsync } = require("../utils/catchAsync");
const Driver = require("../models/driverModel");
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
const moment = require("moment-timezone");
const mongoose = require("mongoose");

/**
 * Get all professional drivers (Public route)
 * Filter by availability status
 * Only returns active drivers
 */
exports.getAllProfessionalDrivers = catchAsync(async (req, res, next) => {
  const { status, available } = req.query;
  
  // Query professional drivers only
  let query = { driverType: "professional" };
  
  if (status) {
    query.status = status;
  }
  
  if (available === "true") {
    query.status = "available";
    query.verified = true;
  }
  
  const drivers = await Driver.find(query).sort({ createdAt: -1 });
  
  res.status(200).json({
    status: "success",
    results: drivers.length,
    data: drivers,
  });
});

/**
 * Get all professional drivers (Admin only)
 * Returns all drivers including inactive ones
 * Supports filtering and pagination
 */
exports.getAdminProfessionalDrivers = catchAsync(async (req, res, next) => {
  const { status, verified, active, search, page = 1, limit = 50 } = req.query;
  
  // Build query
  let query = {};
  
  // Filter by status
  if (status) {
    query.status = status;
  }
  
  // Filter by verification
  if (verified !== undefined) {
    query.verified = verified === "true" || verified === true;
  }
  
  // Filter by status (instead of active field)
  // Note: Driver model uses status field, not active field
  if (active !== undefined) {
    // Map active=true to status != "suspended", active=false to status == "suspended"
    if (active === "true" || active === true) {
      query.status = { $ne: "suspended" };
    } else {
      query.status = "suspended";
    }
  }
  
  // Search by name, email, phone, or license number
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } }, // Also check name field for rental drivers
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { "license.number": { $regex: search, $options: "i" } }, // License number is in license.number
    ];
  }
  
  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);
  
  // Query professional drivers only
  query.driverType = "professional";
  
  // Get total count for pagination
  const total = await Driver.countDocuments(query);
  
  // Fetch drivers with pagination
  const drivers = await Driver.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);
  
  res.status(200).json({
    status: "success",
    results: drivers.length,
    total,
    page: parseInt(page),
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
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
  const driver = await Driver.findOne({ _id: req.params.id, driverType: "professional" });
  
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
  
  const driver = await Driver.findOneAndUpdate(
    { _id: req.params.id, driverType: "professional" },
    updateData,
    {
      new: true,
      runValidators: true,
    }
  );
  
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

/**
 * ========================================
 * RENTAL DRIVER FUNCTIONS
 * ========================================
 */

/**
 * Add a rental driver (User's own driver)
 */
exports.addDriver = catchAsync(async (req, res, next) => {
  // Ensure driverType is set (defaults to "rental" if not provided)
  const driverData = {
    ...req.body,
    user: req.user.id,
    driverType: req.body.driverType || "rental", // Default to rental for user-added drivers
  };
  const driver = await Driver.create(driverData);
  res.status(201).json({
    status: "success",
    data: driver,
  });
});

/**
 * Get user's drivers (rental or professional)
 */
exports.getUserDrivers = catchAsync(async (req, res, next) => {
  // Support filtering by driverType
  const { driverType } = req.query;
  const query = { user: req.user._id };
  
  if (driverType && (driverType === "rental" || driverType === "professional")) {
    query.driverType = driverType;
  }
  
  const drivers = await Driver.find(query);
  res.status(200).json({ status: "success", data: drivers });
});

/**
 * Get all drivers (Admin only - supports filtering by driverType)
 */
exports.getAllDrivers = catchAsync(async (req, res, next) => {
  // Support filtering by driverType (rental or professional)
  const { driverType, page = 1, limit = 50 } = req.query;
  const query = {};
  
  if (driverType && (driverType === "rental" || driverType === "professional")) {
    query.driverType = driverType;
  }
  
  // Add pagination to prevent loading all drivers at once (memory optimization)
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 per page
  
  // Execute query with pagination and lean() for memory efficiency
  const [drivers, total] = await Promise.all([
    Driver.find(query)
      .populate("user", "fullName email")
      .skip(skip)
      .limit(limitNum)
      .lean(), // Use lean() to reduce memory usage
    Driver.countDocuments(query)
  ]);
  
  res.status(200).json({
    status: "success",
    results: drivers.length,
    total,
    page: parseInt(page),
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    data: drivers,
  });
});

/**
 * Verify or reject driver documents (Admin only)
 */
const toDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

exports.verifyDriver = catchAsync(async(req, res, next)=>{
  console.log(req.body)
  const adminUserId = req.user._id
  const {action, documentType, data={}} = req.body

  const {insurance={}, license={}} = data

  console.log(license)
  const {id} = req.params
  const driverId = new mongoose.Types.ObjectId(id)
  if(!driverId){
    return next(new AppError("Invalid driver id", 400));
  }
  if (!adminUserId) {
    return next(new AppError("Unauthorized: missing admin user", 401));
  }
  if (!["license", "insurance"].includes(documentType)) {
    return next(new AppError("`documentType` must be 'license' or 'insurance'", 400));
  }
  const now = new Date()
  const $set = {}
  const $unset={}
  if(action === "verify"){
    if(documentType === "license"){
      const missing = []
      if (!license.number) missing.push("license.number");
      if (!license.issuedBy) missing.push("license.issuedBy");
      if (!license.expiryDate) missing.push("license.expiryDate");
      if (missing.length) {
        return next(new AppError(`Missing fields: ${missing.join(", ")}`, 400));
      }

      $set["license.number"] = license.number;
      $set["license.issuedBy"] = license.issuedBy;
      $set["license.expiryDate"] = toDate(license.expiryDate);
      $set["license.verified"] = true;
      $set["license.verifiedBy"] = adminUserId;
      $set["license.verifiedAt"] = now;
    }
  }

  if (documentType === "insurance") {
    const missing = [];
    if (!insurance.provider) missing.push("insurance.provider");
    if (!insurance.policyNumber) missing.push("insurance.policyNumber");
    if (!insurance.expiryDate) missing.push("insurance.expiryDate");
    if (missing.length) {
      return next(new AppError(`Missing fields: ${missing.join(", ")}`, 400));
    }

    $set["insurance.provider"] = insurance.provider;
    $set["insurance.policyNumber"] = insurance.policyNumber;
    $set["insurance.expiryDate"] = toDate(insurance.expiryDate);
    $set["insurance.verified"] = true;
    $set["insurance.verifiedBy"] = adminUserId;
    $set["insurance.verifiedAt"] = now;
  }
  if (action === "reject") {
    // Reject clears audit marks and flips verified
    if (documentType === "license") {
      $set["license.verified"] = false;
      $unset["license.verifiedBy"] = "";
      $unset["license.verifiedAt"] = "";
      $set["license.rejectedBy"] = adminUserId;
      $set["license.rejectedAt"] = now;
    }

    if (documentType === "insurance") {
      $set["insurance.verified"] = false;
      $unset["insurance.verifiedBy"] = "";
      $unset["insurance.verifiedAt"] = "";
      $set["insurance.rejectedBy"] = adminUserId;
      $set["insurance.rejectedAt"] = now;
    }
  }

  const updatePayload = {};
  if (Object.keys($set).length) updatePayload.$set = $set;
  if (Object.keys($unset).length) updatePayload.$unset = $unset;

  if (!Object.keys(updatePayload).length) {
    return next(new AppError("No changes provided for the requested action", 400));
  }

  const updated = await Driver.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true,
    context: { verifiedBy: adminUserId }, // available to schema hooks if you use it
  })
    .populate({ path: "user", select: "fullName email" }) // optional
    .lean();

  if (!updated) {
    return next(new AppError("Driver not found", 404));
  }

  return res.status(200).json({
    status: "success",
    data: updated,
  });
});

/**
 * Get driver availability summary (Admin only)
 * GET /api/v1/drivers/availability-summary
 */
exports.getDriverAvailabilitySummary = catchAsync(async (req, res, next) => {
  // Aggregate stats by currentStatus
  const stats = await Driver.aggregate([
    {
      $match: { driverType: "professional" }
    },
    {
      $group: {
        _id: "$currentStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total professional drivers
  const totalDrivers = await Driver.countDocuments({ driverType: "professional" });

  // Get last online drivers (sorted by lastActiveAt)
  const lastOnlineDrivers = await Driver.find({ 
    driverType: "professional",
    isOnline: true 
  })
    .select("fullName phone lastActiveAt currentStatus lastAcceptedBooking")
    .populate("lastAcceptedBooking", "pickupDate returnDate status")
    .sort({ lastActiveAt: -1 })
    .limit(50)
    .lean();

  // Format stats for easier consumption
  const statsMap = {};
  stats.forEach(stat => {
    statsMap[stat._id] = stat.count;
  });

  res.status(200).json({
    success: true,
    totalDrivers,
    stats: {
      available: statsMap["available"] || 0,
      onTrip: statsMap["on-trip"] || 0,
      offline: statsMap["offline"] || 0,
    },
    statsRaw: stats,
    lastOnlineDrivers,
  });
});

