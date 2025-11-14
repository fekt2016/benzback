const express = require("express");
const driverController = require("../controllers/driverController");
const authController = require("../controllers/authController");

const router = express.Router();
router.use(authController.protect);
router.get('/', authController.restrictTo("admin"), driverController.getAllDrivers)
router.get('/me', authController.restrictTo("driver"), driverController.getMyProfile);
router.get("/user-drivers", driverController.getUserDrivers);
router.get("/availability-summary", authController.restrictTo("admin"), driverController.getDriverAvailabilitySummary);
router.patch('/verify/:id',  authController.restrictTo("admin"), driverController.verifyDriver)

// Driver status and bookings
router.patch("/status", authController.restrictTo("driver"), driverController.updateDriverStatus);
router.get("/my-bookings", authController.restrictTo("driver"), driverController.getDriverBookings);

module.exports = router;
