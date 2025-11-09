const express = require("express");
const couponController = require("../controllers/couponController");
const authController = require("../controllers/authController");

const router = express.Router();

// Public route - validate coupon
router.post("/validate", couponController.validateCoupon);

// Admin routes
router
  .route("/")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    couponController.getAllCoupons
  )
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    couponController.createCoupon
  );

module.exports = router;

