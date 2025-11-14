// const { catchAsync } = require("../utils/catchAsync");
// const AppError = require("../utils/appError");
// const DriverProfile = require("../models/driverProfileModel");
// const Driver = require("../models/driverModel");
// const Booking = require("../models/bookingModel");
// const User = require("../models/userModel");
// const mongoose = require("mongoose");

// /**
//  * Get driver's own profile
//  * GET /api/v1/driver/me
//  * 
//  * With new unified structure:
//  * - Professional drivers created during signup use unified Driver model (user.driver reference)
//  * - Falls back to DriverProfile for legacy support if Driver doesn't exist
//  */
// exports.getMyProfile = catchAsync(async (req, res, next) => {
//   // First, try to get Driver from user.driver reference (new unified model)
//   const user = await User.findById(req.user._id).select("driver").lean();
  
//   if (user?.driver) {
//     const driver = await Driver.findById(user.driver)
//       .populate({
//         path: "user",
//         select: "fullName email phone avatar role executive address dateOfBirth"
//       })
//       .populate({
//         path: "car",
//         select: "name model brand images pricePerDay hourlyRate availability"
//       })
//       .lean();
    
//     if (driver && driver.driverType === "professional") {
//       // Map Driver model status to DriverProfile format for frontend compatibility
//       // Driver model: "pending", "active", "suspended", "offline"
//       // DriverProfile format: "available", "busy", "offline"
//       let mappedStatus = driver.status;
//       if (driver.status === "active") mappedStatus = "available";
//       else if (driver.status === "pending") mappedStatus = "offline";
//       // Keep "offline" and "suspended" as-is (suspended will show as suspended)
      
//       // Add rating field if missing (default to 0)
//       const driverResponse = {
//         ...driver,
//         status: mappedStatus,
//         rating: driver.rating || 0, // Default rating if not set
//       };
      
//       return res.status(200).json({
//         status: "success",
//         data: {
//           driver: driverResponse,
//         },
//       });
//     }
//   }
  
//   // Fallback to DriverProfile for legacy support
//   const driverProfile = await DriverProfile.findOne({ user: req.user._id })
//     .populate({
//       path: "user",
//       select: "fullName email phone avatar role executive address dateOfBirth"
//     })
//     .lean();

//   if (!driverProfile) {
//     return next(new AppError("Driver profile not found. Please complete your driver registration.", 404));
//   }

//   res.status(200).json({
//     status: "success",
//     data: {
//       driver: driverProfile,
//     },
//   });
// });

// /**
//  * Update driver status (online/offline)
//  * PATCH /api/v1/driver/status
//  * 
//  * With new unified structure:
//  * - Updates unified Driver model if exists, otherwise falls back to DriverProfile
//  */
// exports.updateDriverStatus = catchAsync(async (req, res, next) => {
//   const { status } = req.body;
// console.log("req.body", req.body);
// console.log("status", status);
  
//   const validStatuses = ["available", "busy", "offline", "active", "pending", "suspended"];
//   if (!validStatuses.includes(status)) {
//     return next(new AppError("Invalid status. Must be: available, busy, offline, active, pending, or suspended", 400));
//   }

//   // Try to update unified Driver model first
//   const user = await User.findById(req.user._id).select("driver").lean();
  
//   if (user?.driver) {
//     // Map DriverProfile status to Driver model status
//     // Driver model uses: "pending", "active", "suspended"
//     // DriverProfile uses: "available", "busy", "offline"
//     let driverStatus = status;
//     if (status === "available") driverStatus = "active";
//     else if (status === "offline") driverStatus = "pending";
//     else if (status === "busy") driverStatus = "active"; // Map busy to active for Driver model
//     // If status is already "active", "pending", or "suspended", use as-is
    
//     // Update availability tracking fields
//     const updateData = {
//       status: driverStatus,
//     };
    
//     // Set availability fields based on status
//     if (status === "available" || driverStatus === "active") {
//       updateData.isOnline = true;
//       updateData.currentStatus = "available";
//       updateData.lastActiveAt = new Date();
//       updateData.lastAvailable = new Date();
//     } else if (status === "busy") {
//       updateData.isOnline = true;
//       updateData.currentStatus = "on-trip"; // Busy means on a trip
//       updateData.lastActiveAt = new Date();
//       updateData.lastAvailable = new Date();
//     } else if (status === "offline" || driverStatus === "pending") {
//       updateData.isOnline = false;
//       updateData.currentStatus = "offline";
//       updateData.lastActiveAt = new Date();
//       updateData.lastAvailable = new Date();
//     }
    
//     const driver = await Driver.findByIdAndUpdate(
//       user.driver,
//       updateData,
//       { new: true, runValidators: true }
//     )
//       .populate("user", "fullName email phone")
//       .lean();

//     if (driver && driver.driverType === "professional") {
//       // Emit socket event for status change
//       const io = req.app.get("io");
//       if (io) {
//         io.to("drivers").emit("driver:status_changed", {
//           driverId: driver._id,
//           userId: req.user._id,
//           status: driverStatus,
//         });
//       }

//       // Map status back to DriverProfile format for frontend compatibility
//       let mappedStatus = driverStatus;
//       if (driverStatus === "active") mappedStatus = "available";
//       else if (driverStatus === "pending") mappedStatus = "offline";
//       // Keep "suspended" as-is
      
//       const driverResponse = {
//         ...driver,
//         status: mappedStatus,
//         rating: driver.rating || 0, // Default rating if not set
//       };

//       return res.status(200).json({
//         status: "success",
//         message: `Driver status updated to ${mappedStatus}`,
//         data: {
//           driver: driverResponse,
//         },
//       });
//     }
//   }

//   // Fallback to DriverProfile for legacy support
//   const driverProfile = await DriverProfile.findOneAndUpdate(
//     { user: req.user._id },
//     {
//       status,
//       lastActive: status !== "offline" ? new Date() : undefined,
//     },
//     { new: true, runValidators: true }
//   )
//     .populate("user", "fullName email phone")
//     .lean();

//   if (!driverProfile) {
//     return next(new AppError("Driver profile not found", 404));
//   }

//   // Emit socket event for status change
//   const io = req.app.get("io");
//   if (io) {
//     io.to("drivers").emit("driver:status_changed", {
//       driverId: driverProfile._id,
//       userId: req.user._id,
//       status,
//     });
//   }

//   res.status(200).json({
//     status: "success",
//     message: `Driver status updated to ${status}`,
//     data: {
//       driver: driverProfile,
//     },
//   });
// });

// /**
//  * Get available ride requests
//  * GET /api/v1/driver/requests
//  */
// exports.getAvailableRequests = catchAsync(async (req, res, next) => {
//   const userId = req.user._id;
  
//   // First, verify driver exists and is verified
//   let driverRecord = null;
//   let isVerified = false;
//   let isOnline = false;
  
//   // Check unified Driver model first
//   const user = await User.findById(userId).select("driver").lean();
//   if (user?.driver) {
//     const unifiedDriver = await Driver.findById(user.driver).lean();
//     if (unifiedDriver && unifiedDriver.driverType === "professional") {
//       driverRecord = unifiedDriver;
//       isVerified = unifiedDriver.license?.verified === true || unifiedDriver.verified === true;
//       isOnline = unifiedDriver.status === "active" || unifiedDriver.status === "available" || unifiedDriver.status === "busy";
//     }
//   }
  
//   // Fallback to DriverProfile
//   if (!driverRecord) {
//     const driverProfile = await DriverProfile.findOne({ user: userId }).lean();
//     if (driverProfile) {
//       driverRecord = driverProfile;
//       isVerified = driverProfile.verified === true;
//       isOnline = driverProfile.status === "available" || driverProfile.status === "busy";
//     }
//   }
  
//   // Only return requests if driver is verified and online
//   if (!driverRecord) {
//     return next(new AppError("Driver profile not found. Please complete driver registration.", 404));
//   }
  
//   if (!isVerified) {
//     return res.status(200).json({
//       status: "success",
//       message: "Your license must be verified before you can see ride requests.",
//       results: 0,
//       data: {
//         requests: [],
//       },
//     });
//   }
  
//   if (!isOnline) {
//     return res.status(200).json({
//       status: "success",
//       message: "You must be online to see ride requests. Please update your status to 'Available'.",
//       results: 0,
//       data: {
//         requests: [],
//       },
//     });
//   }
  
//   // Only show pending requests that haven't been accepted
//   const filter = {
//     requestDriver: true,
//     driverRequestStatus: "pending",
//     driverAssigned: false,
//   };

//   // Filter out expired requests in the query (5 minutes)
//   const now = new Date();
//   const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
//   filter.requestedAt = { $gte: fiveMinutesAgo };

//   const paginateQuery = require("../utils/paginateQuery");
//   const { data: requests, pagination } = await paginateQuery(Booking, filter, req, {
//     queryModifier: (query) => query
//       .populate("user", "fullName phone")
//       .populate("car", "name model images pricePerDay")
//       .select("pickupDate returnDate pickupLocation pickupTime totalPrice requestedAt car user")
//       .sort({ requestedAt: -1 }),
//     defaultLimit: 20,
//     maxLimit: 100,
//   });

//   res.status(200).json({
//     status: "success",
//     ...pagination,
//     data: {
//       requests,
//     },
//   });
// });

// /**
//  * Get driver's accepted bookings
//  * GET /api/v1/driver/bookings
//  * 
//  * With new unified structure:
//  * - Supports unified Driver model (user.driver reference)
//  * - Falls back to DriverProfile for legacy support
//  */
// exports.getMyBookings = catchAsync(async (req, res, next) => {
//   // Try to get Driver from user.driver reference (new unified model)
//   const user = await User.findById(req.user._id).select("driver").lean();
//   let driverId = null;
//   let driverModel = null;
  
//   if (user?.driver) {
//     const driver = await Driver.findById(user.driver).lean();
//     if (driver && driver.driverType === "professional") {
//       driverId = driver._id;
//       driverModel = "Driver";
//     }
//   }
  
//   // Fallback to DriverProfile for legacy support
//   if (!driverId) {
//     const driverProfile = await DriverProfile.findOne({ user: req.user._id }).lean();
//     if (!driverProfile) {
//       return next(new AppError("Driver profile not found", 404));
//     }
//     driverId = driverProfile._id;
//     driverModel = "DriverProfile";
//   }

//   // Find bookings where this driver is the accepted driver
//   // Note: Booking model has acceptedDriver field that references DriverProfile
//   // For unified Driver model, we need to check both acceptedDriver and driver fields
//   const filter = {
//     $or: [
//       { acceptedDriver: driverId },
//       { driver: driverId },
//       { professionalDriverId: driverId }
//     ]
//   };

//   const paginateQuery = require("../utils/paginateQuery");
//   const { data: bookings, pagination } = await paginateQuery(Booking, filter, req, {
//     queryModifier: (query) => query
//       .populate("user", "fullName email phone")
//       .populate("car", "name model images")
//       .populate({
//         path: "acceptedDriver",
//         select: "status rating fullName",
//         populate: {
//           path: "user",
//           select: "fullName email phone"
//         }
//       })
//       .populate({
//         path: "driver",
//         select: "status fullName",
//         populate: {
//           path: "user",
//           select: "fullName email phone"
//         }
//       })
//       .sort({ createdAt: -1 }),
//     defaultLimit: 20,
//     maxLimit: 100,
//   });

//   res.status(200).json({
//     status: "success",
//     ...pagination,
//     data: {
//       bookings,
//     },
//   });
// });

// /**
//  * Get driver earnings summary
//  * GET /api/v1/driver/earnings
//  * 
//  * With new unified structure:
//  * - Supports unified Driver model (user.driver reference)
//  * - Falls back to DriverProfile for legacy support
//  */
// exports.getEarnings = catchAsync(async (req, res, next) => {
//   // Try to get Driver from user.driver reference (new unified model)
//   const user = await User.findById(req.user._id).select("driver").lean();
//   let driverId = null;
//   let driverData = null;
  
//   if (user?.driver) {
//     const driver = await Driver.findById(user.driver).lean();
//     if (driver && driver.driverType === "professional") {
//       driverId = driver._id;
//       driverData = driver;
//     }
//   }
  
//   // Fallback to DriverProfile for legacy support
//   if (!driverId) {
//     const driverProfile = await DriverProfile.findOne({ user: req.user._id }).lean();
//     if (!driverProfile) {
//       return next(new AppError("Driver profile not found", 404));
//     }
//     driverId = driverProfile._id;
//     driverData = driverProfile;
//   }

//   // Get completed bookings
//   // Check both acceptedDriver and driver fields for unified model support
//   const completedBookings = await Booking.find({
//     $or: [
//       { acceptedDriver: driverId },
//       { driver: driverId },
//       { professionalDriverId: driverId }
//     ],
//     status: "completed",
//   })
//     .select("totalPrice driverServiceFee createdAt completedAt")
//     .sort({ completedAt: -1 })
//     .lean();

//   // Calculate earnings
//   const totalEarnings = completedBookings.reduce((sum, booking) => {
//     return sum + (booking.driverServiceFee || 0);
//   }, 0);

//   // Group by month for chart data
//   const monthlyEarnings = {};
//   completedBookings.forEach((booking) => {
//     if (booking.completedAt) {
//       const month = new Date(booking.completedAt).toISOString().slice(0, 7); // YYYY-MM
//       if (!monthlyEarnings[month]) {
//         monthlyEarnings[month] = 0;
//       }
//       monthlyEarnings[month] += booking.driverServiceFee || 0;
//     }
//   });

//   res.status(200).json({
//     status: "success",
//     data: {
//       totalEarnings: driverData.totalEarnings || totalEarnings,
//       totalTrips: driverData.totalTrips || completedBookings.length,
//       completedBookings: completedBookings.length,
//       monthlyEarnings: Object.entries(monthlyEarnings).map(([month, amount]) => ({
//         month,
//         amount,
//       })),
//       recentEarnings: completedBookings.slice(0, 10),
//     },
//   });
// });

// /**
//  * Update driver documents
//  * PATCH /api/v1/driver/documents
//  * Files are processed by bookingUpload middleware and URLs are in req.body
//  * 
//  * With new unified structure:
//  * - Updates unified Driver model if exists (uses nested license/insurance structure)
//  * - Falls back to DriverProfile for legacy support
//  */
// exports.updateDriverDocuments = catchAsync(async (req, res, next) => {
//   const { 
//     licenseImage, // From processed files (bookingUpload middleware)
//     insuranceImage, // From processed files
//     licenseNumber, 
//     licenseExpiry, 
//     insuranceProvider, 
//     insurancePolicyNumber, 
//     insuranceExpiry 
//   } = req.body;

//   // Try to get Driver from user.driver reference (new unified model)
//   const user = await User.findById(req.user._id).select("driver").lean();
//   let updatedDriver = null;
  
//   if (user?.driver) {
//     const driver = await Driver.findById(user.driver).lean();
//     if (driver && driver.driverType === "professional") {
//       // Update unified Driver model with nested license/insurance structure
//       const updateData = {};
      
//       // License fields - Driver model uses nested license object
//       if (licenseImage) {
//         updateData["license.fileUrl"] = licenseImage;
//       }
//       if (licenseNumber) {
//         updateData["license.number"] = licenseNumber;
//         updateData.licenseNumber = licenseNumber; // Also set top-level for easy access
//       }
//       if (licenseExpiry) {
//         updateData["license.expiryDate"] = new Date(licenseExpiry);
//       }
      
//       // Insurance fields - Driver model uses nested insurance object
//       if (insuranceImage) {
//         updateData["insurance.fileUrl"] = insuranceImage;
//       }
//       if (insuranceProvider) {
//         updateData["insurance.provider"] = insuranceProvider;
//       }
//       if (insurancePolicyNumber) {
//         updateData["insurance.policyNumber"] = insurancePolicyNumber;
//       }
//       if (insuranceExpiry) {
//         updateData["insurance.expiryDate"] = new Date(insuranceExpiry);
//       }
      
//       // Reset verification when documents are updated
//       if (licenseImage || insuranceImage || licenseNumber || insurancePolicyNumber) {
//         updateData["license.verified"] = false;
//         updateData["insurance.verified"] = false;
//         updateData.verified = false;
//       }
      
//       updatedDriver = await Driver.findByIdAndUpdate(
//         user.driver,
//         { $set: updateData },
//         { new: true, runValidators: true }
//       )
//         .populate("user", "fullName email phone")
//         .lean();
//     }
//   }
  
//   // Fallback to DriverProfile for legacy support
//   if (!updatedDriver) {
//     const updateData = {};
    
//     // License image from file upload (processed by middleware)
//     if (licenseImage) {
//       updateData.licenseImage = licenseImage;
//     }
    
//     // Insurance image from file upload (processed by middleware)
//     if (insuranceImage) {
//       updateData.insuranceImage = insuranceImage;
//     }
    
//     // Text fields
//     if (licenseNumber) updateData.licenseNumber = licenseNumber;
//     if (licenseExpiry) updateData.licenseExpiry = licenseExpiry;
//     if (insuranceProvider) updateData.insuranceProvider = insuranceProvider;
//     if (insurancePolicyNumber) updateData.insurancePolicyNumber = insurancePolicyNumber;
//     if (insuranceExpiry) updateData.insuranceExpiry = insuranceExpiry;

//     // Reset verification when documents are updated
//     if (licenseImage || insuranceImage) {
//       updateData.verified = false;
//       updateData.verifiedAt = null;
//       updateData.verifiedBy = null;
//     }

//     updatedDriver = await DriverProfile.findOneAndUpdate(
//       { user: req.user._id },
//       updateData,
//       { new: true, runValidators: true }
//     )
//       .populate("user", "fullName email phone")
//       .lean();

//     if (!updatedDriver) {
//       return next(new AppError("Driver profile not found", 404));
//     }
//   }

//   res.status(200).json({
//     status: "success",
//     message: "Driver documents updated successfully",
//     data: {
//       driver: updatedDriver,
//     },
//   });
// });

// /**
//  * Create or initialize driver profile
//  * POST /api/v1/driver/register
//  */
// exports.registerDriver = catchAsync(async (req, res, next) => {
//   // Check if profile already exists
//   const existingProfile = await DriverProfile.findOne({ user: req.user._id });
//   if (existingProfile) {
//     return next(new AppError("Driver profile already exists", 400));
//   }

//   // Verify user role is driver
//   if (req.user.role !== "driver") {
//     return next(new AppError("User role must be 'driver' to register as driver", 403));
//   }

//   // Ensure driverType is always "professional" for DriverProfile (cannot be overridden)
//   const { driverType, ...restBody } = req.body;
  
//   const driverProfile = await DriverProfile.create({
//     user: req.user._id,
//     status: "offline",
//     driverType: "professional", // Professional driver (chauffeur) registered via /driver/register
//     ...restBody,
//   });

//   await driverProfile.populate("user", "fullName email phone");

//   res.status(201).json({
//     status: "success",
//     message: "Driver profile created successfully",
//     data: {
//       driver: driverProfile,
//     },
//   });
// });

