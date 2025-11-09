const express = require("express");
const chatController = require("../controllers/chatController");
const authController = require("../controllers/authController");

const router = express.Router();

// All chat routes require authentication
router.use(authController.protect);

// Start a new chat session
router.post("/start", chatController.startChat);

// Send a message and get bot response
router.post("/send", chatController.sendMessage);

// Get chat history
router.get("/history", chatController.getChatHistory);

// Get active chat session
router.get("/active", chatController.getActiveSession);

// Close a chat session
router.patch("/close/:sessionId", chatController.closeSession);

// Escalation route (user can escalate their own chat)
router.post("/escalate/:sessionId", chatController.escalateChat);

// Admin routes - require admin role
router.get("/admin/sessions", authController.restrictTo("admin"), chatController.getAllSessions);
router.get("/admin/waiting", authController.restrictTo("admin"), chatController.getWaitingChats);
router.get("/admin/users", authController.restrictTo("admin"), chatController.getAdminUsers);
router.get("/admin/user/:userId/history", authController.restrictTo("admin"), chatController.getAdminUserHistory);
router.get("/admin/session/:id", authController.restrictTo("admin"), chatController.getSessionById);
router.get("/admin/session/user/:userId", authController.restrictTo("admin"), chatController.getSessionByUserId);
router.post("/admin/join/:sessionId", authController.restrictTo("admin"), chatController.adminJoinChat);
router.post("/admin/reply", authController.restrictTo("admin"), chatController.adminReply);

module.exports = router;

