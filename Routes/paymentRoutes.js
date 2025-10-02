const express = require("express");
const paymentController = require("../controllers/paymentController");
const authController = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// Create a new payment intent/session
router.post(
  "/create-checkout-session",
  authController.restrictTo("user"),
  paymentController.createStripePayment
);
router.get(
  "/verify-payment/:sessionId/:bookingId",
  authController.restrictTo("user"),
  paymentController.verifyPayment
);
router.get(
  "/confirmation/:bookingId",
  authController.restrictTo("user"),
  paymentController.getBookingConfirmation
);
module.exports = router;
