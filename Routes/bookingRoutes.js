const express = require("express");
const bookingController = require("../controllers/bookingController");
const authController = require("../controllers/authController");

const {
  uploadBookingFiles,
  processBookingFiles,
} = require("../middleware/bookingUpload");

const router = express.Router();

router.use(authController.protect);
router
  .route("/")
  .post(
    authController.restrictTo("user"),
    uploadBookingFiles,
    processBookingFiles,
    bookingController.createBooking
  )
  .get(authController.restrictTo("admin"), bookingController.getAllBookings);

router.patch(
  "/:id/documents",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.userUpdateBooking
);
router.patch(
  "/:id/status",
  authController.restrictTo("admin"),
  bookingController.adminUpdateBookingStatus
);

router.get(
  "/my-bookings",
  authController.restrictTo("user"),
  bookingController.getUserBookings
);
router
  .route("/:id")
  .get(authController.restrictTo("user"), bookingController.getBooking);

router
  .route("/:bookingId")
  .patch(authController.restrictTo("admin"), bookingController.updateBooking);
// router.get("/me", bookingController.getUserBookings);
// router.patch("/:id/cancel", bookingController.cancelBooking);
router.patch(
  "/:bookingId/verify-documents",
  authController.restrictTo("admin"),
  bookingController.verifyDocuments
);
router.post(
  "/:bookingId/driver",
  authController.restrictTo("user"),
  uploadBookingFiles,
  processBookingFiles,
  bookingController.addBookingDriver
);
module.exports = router;
