const Driver = require("../models/driverModel");
const Booking = require("../models/bookingModel");
const Car = require("../models/carModel");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const paginateQuery = require("../utils/paginateQuery");
const { sendSuccess } = require("../utils/responseHandler");

/**
 * Get all online drivers with location
 * GET /api/v1/admin/drivers/online
 * Returns drivers with their current location for map display
 */
exports.getOnlineDrivers = catchAsync(async (req, res, next) => {
  const { data: drivers, pagination } = await paginateQuery(
    Driver,
    {
      isOnline: true,
      driverType: "professional",
      status: { $in: ["verified", "active"] },
    },
    req,
    {
      queryModifier: (query) => query
        .select("location isOnline currentStatus user cars")
        .populate("user", "fullName email phone")
        .populate("cars", "title brand model images hourlyRate availability geoLocation")
        .sort("-location.lastUpdated"),
      defaultLimit: 50,
      maxLimit: 200,
    }
  );

  // Format for map display
  const formattedDrivers = drivers.map((driver) => ({
    id: driver._id,
    name: driver.user?.fullName || "Unknown",
    email: driver.user?.email,
    phone: driver.user?.phone,
    location: driver.location,
    status: driver.currentStatus,
    isOnline: driver.isOnline,
    cars: driver.cars || [],
    lastActiveAt: driver.lastActiveAt,
  }));

  res.status(200).json({
    status: "success",
    ...pagination,
    data: formattedDrivers,
  });
});

/**
 * Suspend a driver
 * PATCH /api/v1/admin/drivers/:id/suspend
 */
exports.suspendDriver = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  const driver = await Driver.findById(id);
  if (!driver) {
    return next(new AppError("Driver not found", 404));
  }

  driver.status = "suspended";
  driver.isOnline = false;
  driver.currentStatus = "offline";
  await driver.save();

  // Update all cars owned by this driver to unavailable
  await Car.updateMany(
    { owner: id },
    { availability: "unavailable" }
  );

  res.status(200).json({
    status: "success",
    message: "Driver suspended successfully",
    data: {
      driverId: id,
      reason: reason || "No reason provided",
    },
  });
});

/**
 * Reactivate a suspended driver
 * PATCH /api/v1/admin/drivers/:id/activate
 */
exports.activateDriver = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const driver = await Driver.findById(id);
  if (!driver) {
    return next(new AppError("Driver not found", 404));
  }

  if (driver.status === "suspended") {
    driver.status = driver.verified ? "verified" : "pending";
    await driver.save();

    // Reactivate cars
    await Car.updateMany(
      { owner: id },
      { availability: "available" }
    );
  }

  res.status(200).json({
    status: "success",
    message: "Driver activated successfully",
    data: {
      driverId: id,
    },
  });
});

/**
 * Mark booking as complete
 * PATCH /api/v1/admin/bookings/:id/complete
 */
exports.completeBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  if (booking.status === "completed") {
    return next(new AppError("Booking is already completed", 400));
  }

  booking.status = "completed";
  booking.paymentStatus = "paid";
  
  // Add completion timestamp
  if (!booking.checkOutData) {
    booking.checkOutData = {};
  }
  booking.checkOutData.checkOutTime = new Date();
  booking.checkOutData.checkedOutAt = new Date();
  booking.checkOutData.checkedOutBy = req.user.id;

  await booking.save();

  // Update car availability
  if (booking.car) {
    await Car.findByIdAndUpdate(booking.car, {
      availability: "available",
      status: "available",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Booking marked as complete",
    data: booking,
  });
});

/**
 * Get all bookings (admin view)
 * GET /api/v1/admin/bookings
 */
exports.getAllBookings = catchAsync(async (req, res, next) => {
  const { status, bookingType, driverId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (bookingType) filter.bookingType = bookingType;
  if (driverId) filter.owner = driverId;

  const { data: bookings, pagination } = await paginateQuery(
    Booking,
    filter,
    req,
    {
      queryModifier: (query) => query
        .populate("user", "fullName email phone")
        .populate("car", "title brand model images hourlyRate")
        .populate("owner", "fullName email")
        .sort("-createdAt"),
      defaultLimit: 20,
      maxLimit: 100,
    }
  );

  res.status(200).json({
    status: "success",
    ...pagination,
    data: bookings,
  });
});

/**
 * Get dashboard statistics
 * GET /api/v1/admin/dashboard/stats
 */
exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const [
    totalDrivers,
    onlineDrivers,
    totalCars,
    availableCars,
    totalBookings,
    activeBookings,
    completedBookings,
    totalRevenue,
  ] = await Promise.all([
    Driver.countDocuments({ driverType: "professional" }),
    Driver.countDocuments({ isOnline: true, driverType: "professional" }),
    Car.countDocuments(),
    Car.countDocuments({ availability: "available" }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: { $in: ["active", "in_progress", "confirmed"] } }),
    Booking.countDocuments({ status: "completed" }),
    Booking.aggregate([
      {
        $match: { status: "completed", paymentStatus: "paid" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalPrice" },
        },
      },
    ]),
  ]);

  res.status(200).json({
    status: "success",
    data: {
      drivers: {
        total: totalDrivers,
        online: onlineDrivers,
        offline: totalDrivers - onlineDrivers,
      },
      cars: {
        total: totalCars,
        available: availableCars,
        booked: totalCars - availableCars,
      },
      bookings: {
        total: totalBookings,
        active: activeBookings,
        completed: completedBookings,
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
      },
    },
  });
});

