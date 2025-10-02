const express = require("express");
const {
  getNotifications,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
} = require("../controllers/notificationController");
const authController = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private
router.get("/", authController.restrictTo("user"), getNotifications);

// @desc    Get unread notifications count
// @route   GET /api/v1/notifications/unread-count
// @access  Private
router.get("/unread-count", authController.restrictTo("user"), getUnreadCount);

// @desc    Create a notification
// @route   POST /api/v1/notifications
// @access  Private (Admin can create for users)
router.post("/", createNotification);

// @desc    Mark notification as read
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private
router.patch("/:id/read", markAsRead);

// @desc    Mark all notifications as read
// @route   PATCH /api/v1/notifications/mark-all-read
// @access  Private
router.patch("/mark-all-read", markAllAsRead);

// @desc    Delete a notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private
router.delete("/:id", deleteNotification);

// @desc    Clear all notifications for user
// @route   DELETE /api/v1/notifications/clear-all
// @access  Private
router.delete("/clear-all", clearAll);

// Admin only routes
// @desc    Get all notifications (Admin only)
// @route   GET /api/v1/notifications/admin/all
// @access  Private/Admin
router.get("/admin/all", authController.restrictTo("admin"), getNotifications);

// @desc    Create notification for user (Admin only)
// @route   POST /api/v1/notifications/admin/create
// @access  Private/Admin
router.post(
  "/admin/create",
  authController.restrictTo("admin"),
  createNotification
);

module.exports = router;
