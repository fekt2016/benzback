const express = require("express");
const authController = require("../controllers/authController");
const bookingController = require("../controllers/bookingController");
const {
  uploadBookingFiles,
  processBookingFiles,
} = require("../middleware/bookingUpload");
// const { uploadCheckInImages } = require("../middleware/uploadMiddleware");
const router = express.Router();

router.use(authController.protect);

// FIXED: Specific routes should come before parameterized routes
router.get(
  "/my-bookings",
  authController.restrictTo("user", "admin"),
  bookingController.getUserBookings
);

// FIXED: Move /:id/car before /:id
router.get("/:id/car", bookingController.getCarBooking);

// FIXED: Keep parameterized routes at the bottom
router.get(
  "/:id",
  authController.restrictTo("user","admin"),
  bookingController.getBooking
);

router.route("/").get(authController.protect, authController.restrictTo("admin"), bookingController.getAllBooking).post(
  authController.restrictTo("user", "admin"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.createBooking
);

router.patch(
  "/cancel/:id",
  authController.restrictTo("user", "admin"),
  bookingController.cancelBooking
);

router.post(
  "/:id/driver",
  authController.restrictTo("user", "admin"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.addBookingDriver
);

router.post(
  "/:id/check-in",
  authController.restrictTo("user", "admin"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.checkInBooking
);

router.post(
  "/:id/check-out",
  authController.restrictTo("user", "admin"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.checkOutBooking
);

router.patch(
  "/:id/driver-documents",
  authController.restrictTo("user", "admin"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.UpdateBookingDriver
);

// Driver assignment routes
router.post(
  "/:id/accept-driver",
  authController.protect,
  authController.restrictTo("driver", "admin"),
  bookingController.acceptDriverRequest
);

// Booking reminders
router.get(
  "/reminders",
  authController.protect,
  authController.restrictTo("user", "admin"),
  bookingController.getBookingReminders
);

module.exports = router;
