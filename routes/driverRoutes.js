const express = require("express");
const driverController = require("../controllers/driverController");
const authController = require("../controllers/authController");

const router = express.Router();
router.use(authController.protect);
router.get("/user-drivers", driverController.getUserDrivers);

module.exports = router;
