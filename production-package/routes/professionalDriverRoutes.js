const express = require("express");
const driverController = require("../controllers/driverController");
const authController = require("../controllers/authController");

const router = express.Router();

// Public routes
router.get("/available", driverController.getAvailableDrivers);
router.get("/", driverController.getAllProfessionalDrivers);

// Admin only routes - protected with authentication and admin role
// Must be before /:id route to avoid route conflicts
router.get(
  "/admin/all",
  authController.protect,
  authController.restrictTo("admin"),
  driverController.getAdminProfessionalDrivers
);

// Public route for getting driver by ID (must be after specific admin routes)
router.get("/:id", driverController.getProfessionalDriverById);

// Admin only routes for create, update, delete
router.use(authController.protect);
router.use(authController.restrictTo("admin"));
router.post("/", driverController.createProfessionalDriver);
router.patch("/:id", driverController.updateProfessionalDriver);
router.delete("/:id", driverController.deleteProfessionalDriver);

module.exports = router;

