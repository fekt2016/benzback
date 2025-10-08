const express = require("express");
const authController = require("../controllers/authController");
const bookingController = require("../controllers/bookingController");
const {
  uploadBookingFiles,
  processBookingFiles,
} = require("../middleware/bookingUpload");
const router = express.Router();

router.use(authController.protect);
router.post(
  "/",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.createBooking
);
router.get(
  "/my-bookings",
  authController.restrictTo("user"),
  bookingController.getUserBookings
);
router.patch(
  "/cancel/:id",
  authController.restrictTo("user"),
  bookingController.cancelBooking
);
router.get(
  "/:id",
  authController.restrictTo("user"),
  bookingController.getBooking
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
  bookingController.checkInBooking
);

module.exports = router;
