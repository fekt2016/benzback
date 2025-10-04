const express = require("express");
const authController = require("../controllers/authController");
const router = express.Router();

router.post("/signup", authController.signup);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resendotp", authController.resendOtp);
router.post("/login", authController.login);

router.use(authController.protect);
router.get("/me", authController.getMe);
module.exports = router;
