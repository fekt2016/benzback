const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// Public routes
router.post("/signup", authController.signup);

router.post("/login", authController.sendOtp);
router.post("/verifyotp", authController.verifyOtp);
router.post("/resendotp", authController.resendOtp);
router.post("/forgot-Password", authController.forgotPassword);
router.patch(
  "/reset-Password/:token",
  authController.protect,
  authController.resetPassword
);
// Protect all routes after this middleware
router.use(authController.protect);

// Authenticated user routes ggg
router.get("/me", authController.getMe);
router.patch("/updateMyPassword", authController.updatePassword);
router.post("/logout", authController.logout);

module.exports = router;
