const express = require("express");
const authController = require("../controllers/authController");
const router = express.Router();
const {
  uploadAvatar, // Just the multer part // Check for removal flag
  processAvata,
  processAvatar,
} = require("../middleware/avatarUploadMiddleware");

router.post("/signup", authController.signup);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.patch("/reset-password/:token", authController.resetPassword);

router.use(authController.protect);
router.get("/me", authController.getMe);
router.patch(
  "/update-profile",
  authController.restrictTo("user"),
  authController.updateProfile
);
router.patch("/updateMyPassword", authController.updatePassword);

router.patch(
  "/upload-avatar",
  authController.restrictTo("user"),
  uploadAvatar,
  processAvatar,
  authController.uploadAvatar
);

module.exports = router;
