const express = require("express");
const router = express.Router();
const {
  getMyProfile,
  updateDriverStatus,
  getAvailableRequests,
  getMyBookings,
  getEarnings,
  updateDriverDocuments,
  registerDriver,
} = require("../controllers/driverProfileController");
const authController = require("../controllers/authController");
const {
  uploadBookingFiles,
  processBookingFiles,
} = require("../middleware/bookingUpload");

// All routes require authentication and driver role
router.use(authController.protect);
router.use(authController.restrictTo("driver"));

// Driver profile routes
router.get("/me", getMyProfile);
router.patch("/status", updateDriverStatus);
router.get("/requests", getAvailableRequests);
router.get("/bookings", getMyBookings);
router.get("/earnings", getEarnings);
router.patch(
  "/documents",
  uploadBookingFiles,
  processBookingFiles,
  updateDriverDocuments
);
router.post("/register", registerDriver);

module.exports = router;

