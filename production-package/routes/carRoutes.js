const express = require("express");
const carController = require("../controllers/carController");
const authController = require("../controllers/authController");
const { uploadBookingFiles,processBookingFiles } = require('../middleware/bookingUpload')

const router = express.Router();
router.route("/").get(carController.getAllCars).post(authController.protect, authController.restrictTo('admin'), uploadBookingFiles,
  processBookingFiles,carController.createCar)

// Car availability route (before :id route)
router.route("/:id/availability").get(carController.getCarAvailability);

router.route("/:id").get(carController.getCar).patch(authController.protect, authController.restrictTo('admin'),uploadBookingFiles,processBookingFiles,carController.updateCar).delete(authController.protect, authController.restrictTo('admin'),carController.deleteCar);

module.exports = router;
