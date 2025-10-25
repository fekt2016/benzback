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
  authController.restrictTo("user"),
  bookingController.getUserBookings
);

// FIXED: Move /:id/car before /:id
router.get("/:id/car", bookingController.getCarBooking);

// FIXED: Keep parameterized routes at the bottom
router.get(
  "/:id",
  authController.restrictTo("user"),
  bookingController.getBooking
);

router.post(
  "/",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.createBooking
);

router.patch(
  "/cancel/:id",
  authController.restrictTo("user"),
  bookingController.cancelBooking
);

router.post(
  "/:id/driver",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.addBookingDriver
);

router.post(
  "/:id/check-in",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.checkInBooking
);

router.post(
  "/:id/check-out",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.checkOutBooking
);

router.patch(
  "/:id/driver-documents",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.UpdateBookingDriver
);

module.exports = router;
