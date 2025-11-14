const express = require("express");
const carController = require("../controllers/carController");
const authController = require("../controllers/authController");
const { uploadBookingFiles, processBookingFiles } = require('../middleware/bookingUpload');

const router = express.Router();

// Public routes
router.route("/").get(carController.getAllCars);
router.get("/nearby", carController.getNearbyCars);

// Driver routes (protected, driver role)
router.get("/my-cars", authController.protect, carController.getMyCars);
router.post("/", authController.protect, uploadBookingFiles, processBookingFiles, carController.createCarAsDriver);
router.patch("/:id", authController.protect, uploadBookingFiles, processBookingFiles, carController.updateCarAsDriver);
router.delete("/:id", authController.protect, carController.deleteCarAsDriver);
router.patch("/:id/location", authController.protect, carController.updateCarLocation);

// Admin routes (protected, admin role)
router.post("/admin", authController.protect, authController.restrictTo('admin'), uploadBookingFiles, processBookingFiles, carController.createCar);
router.patch("/admin/:id", authController.protect, authController.restrictTo('admin'), uploadBookingFiles, processBookingFiles, carController.updateCar);
router.delete("/admin/:id", authController.protect, authController.restrictTo('admin'), carController.deleteCar);

// Car availability route (before :id route)
router.route("/:id/availability").get(carController.getCarAvailability);

// Get single car (public)
router.route("/:id").get(carController.getCar);

module.exports = router;
