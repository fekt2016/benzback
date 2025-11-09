const express = require("express");
const activityController = require("../controllers/activityController");
const authController = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// Get current user's activity history
router.get("/me", activityController.getMyActivities);

// Admin and Executive only routes
router.get(
  "/",
  authController.restrictTo("admin", "executive"),
  activityController.getAllActivities
);

router.get(
  "/stats",
  authController.restrictTo("admin", "executive"),
  activityController.getActivityStats
);

module.exports = router;

