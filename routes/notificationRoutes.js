const express = require("express");
const authController = require("../controllers/authController");
const {
  getNotifications,
  getUnreadCount,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authController.protect);

router.get("/my", authController.restrictTo("user"), getNotifications);
router.get("/unread-count", authController.restrictTo("user"), getUnreadCount);

module.exports = router;
