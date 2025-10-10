const express = require("express");
const authController = require("../controllers/authController");
const {
  getNotifications,
  getUnreadCount,
  deleteNotification,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authController.protect);

router.get("/my", authController.restrictTo("user"), getNotifications);
router.get("/unread-count", authController.restrictTo("user"), getUnreadCount);
router.patch("/:id/read", authController.restrictTo("user"), markAsRead);
router.patch(
  "/:id/mark-all-read",
  authController.restrictTo("user"),
  markAllAsRead
);
router.delete("/:id", authController.restrictTo("user"), deleteNotification);

module.exports = router;
