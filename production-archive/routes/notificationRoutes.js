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

router.get("/my", authController.restrictTo("user","admin"), getNotifications);
router.get("/unread-count", authController.restrictTo("user","admin"), getUnreadCount);
router.patch("/:id/read", authController.restrictTo("user","admin"), markAsRead);
router.patch(
  "/:id/mark-all-read",
  authController.restrictTo("user","admin"),
  markAllAsRead
);
router.delete("/:id", authController.restrictTo("user","admin"), deleteNotification);

module.exports = router;
