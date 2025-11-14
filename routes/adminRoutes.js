const express = require("express");
const adminController = require("../controllers/adminController");
const authController = require("../controllers/authController");

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authController.protect);
router.use(authController.restrictTo("admin", "executive"));

// Dashboard stats
router.get("/dashboard/stats", adminController.getDashboardStats);

// Driver management
router.get("/drivers/online", adminController.getOnlineDrivers);
router.patch("/drivers/:id/suspend", adminController.suspendDriver);
router.patch("/drivers/:id/activate", adminController.activateDriver);

// Booking management
router.get("/bookings", adminController.getAllBookings);
router.patch("/bookings/:id/complete", adminController.completeBooking);

module.exports = router;

