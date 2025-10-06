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
module.exports = router;
