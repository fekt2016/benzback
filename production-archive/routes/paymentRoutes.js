const express = require("express");
const authController = require("../controllers/authController");
const paymentController = require("../controllers/paymentController");
const router = express.Router();

router.use(authController.protect);
router.post(
  "/create-checkout-session",
  authController.restrictTo("user", "admin"),
  paymentController.createStripePayment
);

router.get(
  "/confirmation/:bookingId",
  authController.restrictTo("user", "admin"),
  paymentController.getBookingConfirmation
);
module.exports = router;
