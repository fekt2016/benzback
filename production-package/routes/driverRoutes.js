const express = require("express");
const driverController = require("../controllers/driverController");
const authController = require("../controllers/authController");

const router = express.Router();
router.use(authController.protect);
router.get('/', authController.restrictTo("admin"), driverController.getAllDrivers)
router.get("/user-drivers", driverController.getUserDrivers);
router.get("/availability-summary", authController.restrictTo("admin"), driverController.getDriverAvailabilitySummary);
router.patch('/verify/:id',  authController.restrictTo("admin"), driverController.verifyDriver)

module.exports = router;
