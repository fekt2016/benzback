const express = require("express");
const carController = require("../controllers/carController");
const authController = require("../controllers/authController");
const {
  uploadCarImages,
  processCarImages,
} = require("../middleware/uploadCarImages");

const router = express.Router();

// router.route("/models").get(carController.getCars);
router.route("/").get(
  // authController.protect,
  // authController.restrictTo("admin"),
  carController.getAllCars
);

router.post(
  "/",
  authController.protect,
  authController.restrictTo("admin"),
  uploadCarImages,
  processCarImages,
  carController.createCar
);

router
  .route("/:id")
  .get(carController.getCar)
  .patch(
    authController.protect,
    authController.restrictTo("admin"),
    uploadCarImages,
    processCarImages,
    carController.updateCar
  )
  .delete(
    authController.protect,
    authController.restrictTo("admin"),
    carController.deleteCar
  );

module.exports = router;
