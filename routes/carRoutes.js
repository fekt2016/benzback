const express = require("express");
const carController = require("../controllers/carController");
const authController = require("../controllers/authController");

const router = express.Router();
router.route("/").get(carController.getAllCars);
router.route("/:id").get(carController.getCar);
module.exports = router;
