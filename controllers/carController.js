const Car = require("../models/carModel");
const Driver = require("../models/driverModel");
const { catchAsync } = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { findByIdOrFail } = require("../utils/findByIdHelper");
const paginateQuery = require("../utils/paginateQuery");
const { sendSuccess, sendCreated, sendDeleted } = require("../utils/responseHandler");
const { buildTextSearch, buildNumericRange, buildStatusFilter, mergeFilters } = require("../utils/queryBuilder");

/**
 * Get all cars with driver population
 * Returns: { status: "success", results: number, data: Car[] }
 * Includes driver name, photo, and location via population
 */
exports.getAllCars = catchAsync(async (req, res, next) => {
  const { sort = "-createdAt", status, make, series, minPrice, maxPrice } = req.query;

  // Build filter using query builder utilities
  const filters = mergeFilters(
    buildStatusFilter(status, "status"),
    make ? { make: { $regex: make, $options: "i" } } : {},
    series ? { series: { $regex: series, $options: "i" } } : {},
    buildNumericRange(minPrice, maxPrice, "hourlyRate") // Use hourlyRate instead of pricePerDay
  );

  // Execute paginated query with driver population
  const { data: cars, pagination } = await paginateQuery(Car, filters, req, {
    queryModifier: (query) => query
      .select("-rentalHistory -__v")
      .populate({
        path: "driver",
        select: "fullName email phone location verified available isOnline currentStatus",
        populate: {
          path: "user",
          select: "name photo",
        },
      })
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
    populate: {
      path: "driver",
      select: "fullName email phone location verified available isOnline currentStatus",
      populate: {
        path: "user",
        select: "name photo",
      },
    },
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

/**
 * Get driver's car (one-driver-one-car rule)
 * GET /api/v1/cars/my-cars
 * Driver can see their single car
 */
exports.getMyCars = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  // Find driver profile
  const driver = await Driver.findOne({ user: userId, driverType: "professional" })
    .populate({
      path: "car",
      select: "-rentalHistory -__v",
    });
  
  if (!driver) {
    return next(new AppError("Driver profile not found", 404));
  }
  
  // Return single car or empty array
  const cars = driver.car ? [driver.car] : [];
  
  res.status(200).json({
    status: "success",
    results: cars.length,
    data: cars,
  });
});

/**
 * Create car (as driver) - Enforces one-driver-one-car rule
 * POST /api/v1/cars
 * Driver creates a new car listing (or updates existing if already has one)
 */
exports.createCarAsDriver = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  // Find driver profile
  const driver = await Driver.findOne({ user: userId, driverType: "professional" });
  if (!driver) {
    return next(new AppError("Driver profile not found. Please complete driver registration.", 404));
  }
  
  // Check if driver already has a car (one-driver-one-car rule)
  if (driver.car) {
    // Driver already has a car - reject new upload, suggest updating existing
    return next(new AppError(
      "You already have a car registered. Please update your existing car instead of creating a new one.",
      400
    ));
  }
  
  const {
    make,
    model,
    year,
    color,
    hourlyRate,
    photos,
    status,
    geoLocation,
    images, // Legacy field
    features,
    description,
    transmission,
    fuelType,
    seats,
    // Legacy fields for backward compatibility
    title,
    brand,
    availability,
    series,
    pricePerDay,
  } = req.body;
  
  // Validate required fields
  if (!make || !model || !year || !hourlyRate) {
    return next(new AppError("make, model, year, and hourlyRate are required", 400));
  }
  
  // Use photos or images (backward compatibility)
  const carPhotos = photos || images || req.body.carImages || [];
  
  // Create car with driver reference (unique)
  const car = await Car.create({
    driver: driver._id, // Required, unique
    make: make || brand,
    model,
    year: Number(year),
    color: color || undefined,
    hourlyRate: Number(hourlyRate),
    photos: carPhotos,
    status: status || "available",
    geoLocation: geoLocation ? {
      lat: Number(geoLocation.lat),
      lng: Number(geoLocation.lng),
      lastUpdated: new Date(),
    } : driver.location ? {
      lat: driver.location.lat,
      lng: driver.location.lng,
      lastUpdated: new Date(),
    } : undefined,
    features: Array.isArray(features) ? features : [],
    description,
    transmission: transmission || "automatic",
    fuelType: fuelType || "petrol",
    seats: seats ? Number(seats) : 4,
    // Legacy fields for backward compatibility
    title: title || `${make || brand} ${model}`,
    brand: brand || make,
    availability: availability || status || "available",
    images: carPhotos, // Sync with photos
    series,
    pricePerDay: pricePerDay ? Number(pricePerDay) : undefined,
  });
  
  // Link car to driver
  driver.car = car._id;
  // Update driver's hourlyRate if provided
  if (hourlyRate) {
    driver.hourlyRate = Number(hourlyRate);
  }
  // Update driver's location if provided
  if (geoLocation) {
    driver.location = {
      lat: Number(geoLocation.lat),
      lng: Number(geoLocation.lng),
      lastUpdated: new Date(),
    };
  }
  await driver.save();
  
  // Populate driver info for response
  await car.populate({
    path: "driver",
    select: "fullName email phone location verified available",
  });
  
  sendCreated(res, car, "Car created successfully");
});

/**
 * Update car (as driver - only their own)
 * PATCH /api/v1/cars/:id
 * Enforces one-driver-one-car rule
 */
exports.updateCarAsDriver = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Find driver
  const driver = await Driver.findOne({ user: userId, driverType: "professional" });
  if (!driver) {
    return next(new AppError("Driver profile not found", 404));
  }
  
  // Verify car belongs to driver (one-driver-one-car rule)
  const car = await Car.findById(id);
  if (!car) {
    return next(new AppError("Car not found", 404));
  }
  
  if (car.driver?.toString() !== driver._id.toString()) {
    return next(new AppError("You can only update your own car", 403));
  }
  
  // Verify driver's car reference matches
  if (driver.car?.toString() !== car._id.toString()) {
    return next(new AppError("Car reference mismatch", 400));
  }
  
  // Update allowed fields (including new one-driver-one-car fields)
  const allowedFields = [
    "make",
    "model",
    "year",
    "color",
    "hourlyRate",
    "photos",
    "status",
    "geoLocation",
    "features",
    "description",
    "transmission",
    "fuelType",
    "seats",
    // Legacy fields for backward compatibility
    "title",
    "brand",
    "availability",
    "images",
  ];
  
  const update = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === "geoLocation" && req.body[field]) {
        update["geoLocation.lat"] = Number(req.body[field].lat);
        update["geoLocation.lng"] = Number(req.body[field].lng);
        update["geoLocation.lastUpdated"] = new Date();
      } else if (field === "hourlyRate") {
        update[field] = Number(req.body[field]);
      } else if (field === "year" || field === "seats") {
        update[field] = Number(req.body[field]);
      } else {
        update[field] = req.body[field];
      }
    }
  });
  
  // Handle photos/images
  if (req.body.photos && Array.isArray(req.body.photos)) {
    update.photos = req.body.photos;
    update.images = req.body.photos; // Sync for backward compatibility
  } else if (req.body.carImages && Array.isArray(req.body.carImages)) {
    update.photos = req.body.carImages;
    update.images = req.body.carImages;
  }
  
  const updatedCar = await Car.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
  
  sendSuccess(res, 200, updatedCar);
});

/**
 * Delete car (as driver - only their own)
 * DELETE /api/v1/cars/:id
 */
exports.deleteCarAsDriver = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Find driver
  const driver = await Driver.findOne({ user: userId, driverType: "professional" });
  if (!driver) {
    return next(new AppError("Driver profile not found", 404));
  }
  
  // Verify car belongs to driver
  const car = await Car.findById(id);
  if (!car) {
    return next(new AppError("Car not found", 404));
  }
  
  if (car.driver?.toString() !== driver._id.toString()) {
    return next(new AppError("You can only delete your own car", 403));
  }
  
  // Verify driver's car reference matches (one-driver-one-car rule)
  if (driver.car?.toString() !== car._id.toString()) {
    return next(new AppError("Car reference mismatch", 400));
  }
  
  // Remove car reference from driver
  driver.car = null;
  await driver.save();
  
  await Car.findByIdAndDelete(id);
  
  sendDeleted(res, "Car deleted successfully");
});

/**
 * Update car location (real-time)
 * PATCH /api/v1/cars/:id/location
 */
/**
 * Get nearby cars (for users)
 * GET /api/v1/cars/nearby?lat=38.6270&lng=-90.1994&radius=10
 */
exports.getNearbyCars = catchAsync(async (req, res, next) => {
  const { lat, lng, radius = 10 } = req.query; // radius in kilometers

  if (!lat || !lng) {
    return next(new AppError("Latitude and longitude are required", 400));
  }

  const userLat = Number(lat);
  const userLng = Number(lng);
  const radiusKm = Number(radius);

  // Convert radius from km to degrees (approximate)
  // 1 degree latitude ≈ 111 km
  // 1 degree longitude ≈ 111 km * cos(latitude)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(userLat * Math.PI / 180));

  // Find cars within radius with online drivers (one-driver-one-car)
  const cars = await Car.find({
    driver: { $exists: true, $ne: null },
    status: "available",
    $or: [
      {
        "geoLocation.lat": {
          $gte: userLat - latDelta,
          $lte: userLat + latDelta,
        },
        "geoLocation.lng": {
          $gte: userLng - lngDelta,
          $lte: userLng + lngDelta,
        },
      },
      // Also check driver location if car geoLocation not set
      {
        "driver.location.lat": {
          $gte: userLat - latDelta,
          $lte: userLat + latDelta,
        },
        "driver.location.lng": {
          $gte: userLng - lngDelta,
          $lte: userLng + lngDelta,
        },
      },
    ],
  })
    .populate({
      path: "driver",
      match: { 
        isOnline: true,
        currentStatus: "available",
        verified: true,
        available: true,
      },
      select: "fullName email phone location verified available isOnline currentStatus",
      populate: {
        path: "user",
        select: "name photo",
      },
    })
    .select("-rentalHistory -__v")
    .lean();

  // Filter out cars with offline/unavailable drivers and calculate distance
  const nearbyCars = cars
    .filter(car => car.driver && car.driver.isOnline && car.driver.available)
    .map(car => {
      // Calculate distance using Haversine formula
      // Use car geoLocation or driver location
      const carLat = car.geoLocation?.lat || car.driver?.location?.lat;
      const carLng = car.geoLocation?.lng || car.driver?.location?.lng;
      
      if (!carLat || !carLng) {
        return null; // Skip if no location data
      }
      
      const R = 6371; // Earth's radius in km
      const dLat = (carLat - userLat) * Math.PI / 180;
      const dLng = (carLng - userLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(carLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return {
        ...car,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      };
    })
    .filter(car => car !== null) // Remove null entries
    .filter(car => car.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  res.status(200).json({
    status: "success",
    results: nearbyCars.length,
    data: nearbyCars,
  });
});

exports.updateCarLocation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  
  if (!lat || !lng) {
    return next(new AppError("Latitude and longitude are required", 400));
  }
  
  const car = await Car.findByIdAndUpdate(
    id,
    {
      "geoLocation.lat": Number(lat),
      "geoLocation.lng": Number(lng),
      "geoLocation.lastUpdated": new Date(),
    },
    { new: true }
  );
  
  if (!car) {
    return next(new AppError("Car not found", 404));
  }
  
  sendSuccess(res, 200, car);
});