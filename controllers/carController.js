const Car = require("../models/carModel");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { findByIdOrFail } = require("../utils/findByIdHelper");
const paginateQuery = require("../utils/paginateQuery");
const { sendSuccess, sendCreated, sendDeleted } = require("../utils/responseHandler");
const { buildTextSearch, buildNumericRange, buildStatusFilter, mergeFilters } = require("../utils/queryBuilder");

/**
 * Get all cars
 * Returns: { status: "success", results: number, data: Car[] }
 */
exports.getAllCars = catchAsync(async (req, res, next) => {
  const { sort = "-createdAt", status, make, series, minPrice, maxPrice } = req.query;

  // Build filter using query builder utilities
  const filters = mergeFilters(
    buildStatusFilter(status, "status"),
    make ? { make: { $regex: make, $options: "i" } } : {},
    series ? { series: { $regex: series, $options: "i" } } : {},
    buildNumericRange(minPrice, maxPrice, "pricePerDay")
  );

  // Execute paginated query
  const { data: cars, pagination } = await paginateQuery(Car, filters, req, {
    queryModifier: (query) => query
      .select("-rentalHistory -__v")
      .sort(sort),
    defaultLimit: 20,
    maxLimit: 100,
  });

  // Send paginated response
  res.status(200).json({
    status: "success",
    ...pagination,
    data: cars,
  });
});

/**
 * Get car by ID
 * Returns: { status: "success", data: Car }
 */
exports.getCar = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const car = await findByIdOrFail(Car, id, {
    select: "-rentalHistory -__v",
    notFoundMessage: "Car not found",
  });
  
  sendSuccess(res, 200, car);
});
// controllers/carController.js


exports.createCar = catchAsync(async (req, res, next) => {
  console.log(req.body)
   const {
    type,
    make,
    series,
    model,
    year,
    pricePerDay,      // REQUIRED by your schema
    transmission,
    fuelType,
    seats,
    description,
    features,
    status,
    pickupWindow,
    extraMileRate,
    currentOdometer,
    fuelLevel,
    fuelCapacity,
    licensePlate,
  } = req.body;
  let parsedFeatures = Array.isArray(features) ? features : [];
  if (typeof features === "string") {
    try { parsedFeatures = JSON.parse(features); } catch {}
  }

 


   let parsedPickupWindow;
  if (typeof pickupWindow === "string") {
    try { parsedPickupWindow = JSON.parse(pickupWindow); } catch {}
  } else if (pickupWindow && typeof pickupWindow === "object") {
    parsedPickupWindow = pickupWindow;
  }
 const car = await Car.create({
    type,
    make,
    series,
    model,
    year: year ? Number(year) : undefined,
    pricePerDay: pricePerDay ? Number(pricePerDay) : undefined,
    licensePlate, // <- ensure your form provides this
    transmission,
    fuelType,
    currentOdometer,
    seats: seats ? Number(seats) : undefined,
    description,
    features: parsedFeatures,
    images: req.body.carImages || [],  // set by processCarImages 
    status,
    pickupWindow: parsedPickupWindow,
    extraMileRate: extraMileRate ? Number(extraMileRate) : undefined,
    currentOdometer: currentOdometer ? Number(currentOdometer) : undefined,
    fuelLevel: fuelLevel ? Number(fuelLevel) : undefined,
    fuelCapacity: fuelCapacity ? Number(fuelCapacity) : undefined,
  });
  sendCreated(res, car, "Car created successfully");
});

/**
 * Delete car by ID
 * Returns: { status: "success", message: string }
 */
exports.deleteCar = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Verify car exists
  await findByIdOrFail(Car, id, { notFoundMessage: "Car not found" });
  
  await Car.findByIdAndDelete(id);

  sendDeleted(res, "Car deleted successfully");
});

exports.updateCar = catchAsync( async (req, res, next) => {
  const { id } = req.params;

  // 1) Ensure car exists
  const car = await findByIdOrFail(Car, id, { notFoundMessage: "Car not found" });

  // 2) Parse/normalize body fields
  const pick = (obj, keys) =>
    keys.reduce((acc, k) => {
      if (obj[k] !== undefined) acc[k] = obj[k];
      return acc;
    }, {});

  const raw = pick(req.body, [
    "model",
    "series",
    "year",
    "pricePerDay",
    "status",
    "licensePlate",
    "currentOdometer",
    "description",
    "transmission",
    "fuelType",
    "seats",
  ]);

  // Cast numerics safely
  const toNum = (v) =>
    v === undefined || v === null || v === "" || Number.isNaN(Number(v))
      ? undefined
      : Number(v);

  const update = {
    ...(raw.model && { model: raw.model.trim() }),
    ...(raw.series && { series: raw.series.trim() }),
    ...(raw.year !== undefined && { year: toNum(raw.year) }),
    ...(raw.pricePerDay !== undefined && { pricePerDay: toNum(raw.pricePerDay) }),
    ...(raw.status && { status: raw.status }),
    ...(raw.licensePlate && { licensePlate: String(raw.licensePlate).trim().toUpperCase() }),
    ...(raw.currentOdometer !== undefined && {
      currentOdometer: Math.max(0, toNum(raw.currentOdometer) || 0),
    }),
    ...(raw.description !== undefined && { description: raw.description }),
    ...(raw.transmission && { transmission: raw.transmission }),
    ...(raw.fuelType && { fuelType: raw.fuelType }),
    ...(raw.seats !== undefined && { seats: toNum(raw.seats) }),
  };

  // 3) Images merging
  // existingImages is a JSON string from the client representing the URLs the user kept
  let existingImages = undefined;
  if (req.body.existingImages !== undefined) {
    try {
      const parsed = JSON.parse(req.body.existingImages);
      if (Array.isArray(parsed)) {
        existingImages = parsed.filter((u) => typeof u === "string" && u.length > 0);
      } else {
        existingImages = [];
      }
    } catch {
      // If not valid JSON, treat as no existing images provided
      existingImages = [];
    }
  }

  // new uploaded URLs from the unified upload middleware (it sets req.body.carImages to array of Cloudinary URLs)
  let newUploaded = [];
  if (Array.isArray(req.body.carImages)) {
    newUploaded = req.body.carImages.filter((u) => typeof u === "string" && u.length > 0);
  } else if (typeof req.body.carImages === "string" && req.body.carImages.length > 0) {
    newUploaded = [req.body.carImages];
  }

  // If the client provided existingImages OR uploaded new ones, we replace the images array accordingly.
  // If neither is provided, we leave images untouched.
  if (existingImages !== undefined || newUploaded.length > 0) {
    const merged = [
      ...(Array.isArray(existingImages) ? existingImages : car.images || []),
      ...newUploaded,
    ];
    update.images = merged;
  }

  // 4) Persist
  try {
    const updatedCar = await Car.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    sendSuccess(res, 200, updatedCar);
  } catch (err) {
    // Handle duplicate licensePlate nicely
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.licensePlate) {
      return next(new AppError("License plate already exists. Please use a unique value.", 400));
    }
    return next(err);
  }
});

/**
 * Get car availability calendar
 * GET /api/v1/cars/:id/availability
 */
exports.getCarAvailability = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const car = await findByIdOrFail(Car, id, { notFoundMessage: "Car not found" });

  // Default to next 3 months if no dates provided
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate
    ? new Date(endDate)
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  // Get all bookings for this car in the date range
  const Booking = require("../models/bookingModel");
  const bookings = await Booking.find({
    car: id,
    status: { $in: ["confirmed", "active", "pending", "pending_payment"] },
    $or: [
      {
        pickupDate: { $lte: end },
        returnDate: { $gte: start },
      },
    ],
  }).select("pickupDate returnDate status");

  // Format unavailable dates
  const unavailableDates = bookings.map((booking) => ({
    start: booking.pickupDate,
    end: booking.returnDate,
    status: booking.status,
  }));

  // Calculate peak/off-peak pricing (example: weekends are peak)
  const pricingTiers = {
    peak: {
      multiplier: 1.2, // 20% premium
      days: [0, 6], // Sunday, Saturday
    },
    offPeak: {
      multiplier: 0.9, // 10% discount
      days: [1, 2, 3, 4, 5], // Weekdays
    },
  };

  sendSuccess(res, 200, {
    carId: id,
    unavailableDates,
    pricingTiers,
    basePrice: car.pricePerDay,
  });
});