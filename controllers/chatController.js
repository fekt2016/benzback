const { catchAsync } = require("../utils/catchAsync");
const ChatSession = require("../models/chatSessionModel");
const AppError = require("../utils/appError");

/**
 * Helper function to emit socket events for chat
 */
const emitChatEvent = (req, eventName, data) => {
  try {
    const io = req.app.get("io");
    if (io) {
      const sessionId = data.sessionId || data.session?._id?.toString();
      if (sessionId) {
        // Emit to all users in the chat room
        io.to(`chat:${sessionId}`).emit(eventName, data);
        // Also emit to admin room for admin notifications
        io.to("admin").emit(eventName, data);
      }
    }
  } catch (error) {
    console.error("[Chat] Error emitting socket event:", error);
  }
};

/**
 * Check if user message indicates escalation request
 */
const shouldEscalate = (userMessage) => {
  const message = userMessage.toLowerCase().trim();
  const escalationKeywords = [
    "talk to support",
    "talk to agent",
    "talk to human",
    "human agent",
    "live agent",
    "real person",
    "speak to someone",
    "connect me to",
    "escalate",
    "need help",
    "can't help",
    "not helpful",
  ];
  return escalationKeywords.some((keyword) => message.includes(keyword));
};

/**
 * Rule-based chatbot logic
 * Returns bot response based on user message keywords
 */
const getBotResponse = (userMessage) => {
  const message = userMessage.toLowerCase().trim();

  // Check for escalation request
  if (shouldEscalate(message)) {
    return {
      message:
        "I understand you'd like to speak with a human agent. Let me connect you with one of our support specialists right away! 🧑‍💼\n\nPlease wait while I transfer you...",
      intent: "escalation",
      shouldEscalate: true,
    };
  }

  // Booking-related keywords
  if (
    message.includes("book") ||
    message.includes("booking") ||
    message.includes("reserve") ||
    message.includes("rent") ||
    message.includes("rental")
  ) {
    return {
      message:
        "To book a vehicle, please visit our Models page to browse available cars. You can select your preferred dates, pickup location, and add a professional driver if needed. Once you complete the booking, you'll receive a confirmation email. Need help with a specific booking? Let me know!",
      intent: "booking",
      shouldEscalate: false,
    };
  }

  // Driver/Chauffeur-related keywords
  if (
    message.includes("driver") ||
    message.includes("chauffeur") ||
    message.includes("professional driver") ||
    message.includes("rate") ||
    message.includes("hourly")
  ) {
    return {
      message:
        "Our professional chauffeur service is available at $35/hour. You can request a driver when booking your vehicle. Our drivers are fully licensed, verified, and insured. They'll handle all the driving so you can relax and enjoy your ride. Would you like to know more about our driver service?",
      intent: "driver",
      shouldEscalate: false,
    };
  }

  // Contact/Support-related keywords
  if (
    message.includes("contact") ||
    message.includes("support") ||
    message.includes("help") ||
    message.includes("phone") ||
    message.includes("email") ||
    message.includes("address")
  ) {
    return {
      message:
        "You can reach BenzFlex support at:\n📧 Email: support@benzflex.com\n📞 Phone: +1 (555) 123-4567\n📍 Address: [Your Business Address]\n\nOur support team is available Monday-Friday, 9 AM - 6 PM EST. For urgent matters, please call us directly. How else can I assist you?",
      intent: "contact",
      shouldEscalate: false,
    };
  }

  // Pricing-related keywords
  if (
    message.includes("price") ||
    message.includes("cost") ||
    message.includes("fee") ||
    message.includes("charge") ||
    message.includes("pricing")
  ) {
    return {
      message:
        "Our pricing varies by vehicle model and rental duration. You can see detailed pricing on each car's detail page. We offer competitive rates with transparent pricing - no hidden fees. Professional driver service is $35/hour. Would you like to browse our available models to see specific pricing?",
      intent: "pricing",
      shouldEscalate: false,
    };
  }

  // Default fallback response
  return {
    message:
      "I'm BenzBot 🤖 — here to assist! I can help you with:\n• Booking a vehicle\n• Professional driver services\n• Contact information\n• Pricing details\n\nType 'support' or click 'Talk to Agent' anytime to speak with a human agent.",
    intent: "general",
    shouldEscalate: false,
  };
};

/**
 * Start a new chat session
 * POST /api/v1/chat/start
 * Only users can start chats - admins cannot
 */
exports.startChat = catchAsync(async (req, res, next) => {
  // Only allow users to start chats - admins cannot initiate
  if (req.user.role !== "user") {
    return next(new AppError("Only users can start chats. Admins cannot initiate chat sessions.", 403));
  }

  const userId = req.user._id;

  // Check if user has an active session
  let session = await ChatSession.findOne({
    userId,
    isActive: true,
    status: { $ne: "closed" },
  }).sort({ createdAt: -1 });

  // If no active session, create a new one
  if (!session) {
    const welcomeMessage = "Hi! I'm BenzBot 🤖 — How can I help you today?";
    session = await ChatSession.create({
      userId,
      isActive: true,
      status: "bot",
      isEscalated: false,
      initiatedByUser: true, // Mark as user-initiated
      messages: [
        {
          senderRole: "bot",
          message: welcomeMessage,
          isBot: true,
        },
      ],
      lastActiveAt: new Date(),
      lastMessage: welcomeMessage,
      lastMessageAt: new Date(),
    });
  }

  // Populate user data
  await session.populate("userId", "fullName email");

  // Emit socket event for new session
  emitChatEvent(req, "session_created", {
    sessionId: session._id.toString(),
    session: session,
  });

  // Notify admins that a new user-initiated chat has started
  // Admins automatically see chats once they're started by users
  emitChatEvent(req, "userChatStarted", {
    sessionId: session._id.toString(),
    session: session,
    userId: session.userId,
  });

  res.status(200).json({
    status: "success",
    data: {
      session: session,
    },
  });
});

/**
 * Send a message and get bot response
 * POST /api/v1/chat/send
 */
exports.sendMessage = catchAsync(async (req, res, next) => {
  const { message, sessionId } = req.body;
  const userId = req.user._id;

  if (!message || !message.trim()) {
    return next(new AppError("Message cannot be empty", 400));
  }

  // Find or create session
  let session;
  if (sessionId) {
    session = await ChatSession.findOne({
      _id: sessionId,
      userId,
      isActive: true,
    });
  } else {
    // If no sessionId provided, find or create active session
    session = await ChatSession.findOne({
      userId,
      isActive: true,
    }).sort({ createdAt: -1 });
  }

  if (!session) {
    // Create new session if none exists (only users can do this via sendMessage)
    if (req.user.role !== "user") {
      return next(new AppError("Only users can create chat sessions. Please use /chat/start to begin a chat.", 403));
    }
    const welcomeMessage = "Hi! I'm BenzBot 🤖 — How can I help you today?";
    session = await ChatSession.create({
      userId,
      isActive: true,
      status: "bot",
      isEscalated: false,
      initiatedByUser: true, // Mark as user-initiated
      messages: [
        {
          senderRole: "bot",
          message: welcomeMessage,
          isBot: true,
          createdAt: new Date(),
        },
      ],
      lastActiveAt: new Date(),
      lastMessage: welcomeMessage,
      lastMessageAt: new Date(),
    });
  }

  // Add user message
  session.messages.push({
    senderRole: "user",
    message: message.trim(),
    isBot: false,
    createdAt: new Date(),
  });

  // Update last message fields
  session.lastMessage = message.trim();
  session.lastMessageAt = new Date();

  // Bot should ONLY respond to USER messages, and ONLY when:
  // 1. Chat status is "bot" (not escalated)
  // 2. No admin is assigned
  // 3. Chat is not escalated
  const shouldBotRespond = 
    session.status === "bot" && 
    !session.isEscalated && 
    !session.assignedAdmin;

  if (shouldBotRespond) {
    // Get bot response
    const botResponse = getBotResponse(message);

    // Add bot message
    session.messages.push({
      senderRole: "bot",
      message: botResponse.message,
      isBot: true,
      createdAt: new Date(),
    });

    // Update last message fields with bot response
    session.lastMessage = botResponse.message;
    session.lastMessageAt = new Date();

    // Check if bot response indicates escalation
    if (botResponse.shouldEscalate) {
      session.status = "waiting";
      session.isEscalated = true;
      session.escalatedAt = new Date();
      
      // Notify admins of new support request
      emitChatEvent(req, "newSupportRequest", {
        sessionId: session._id.toString(),
        session: session,
      });
    }
  }

  // Update last active time
  session.lastActiveAt = new Date();

  // Save session
  await session.save();

  // Populate user data
  await session.populate("userId", "fullName email");

  // Emit socket events for real-time updates
  // Emit user message
  emitChatEvent(req, "new_message", {
    sessionId: session._id.toString(),
    session: session,
    message: session.messages[session.messages.length - (shouldBotRespond ? 2 : 1)], // User message (or bot if bot responded)
  });
  
  // If bot responded, emit bot message separately
  if (shouldBotRespond) {
    const botMessage = session.messages[session.messages.length - 1];
    emitChatEvent(req, "new_message", {
      sessionId: session._id.toString(),
      session: session,
      message: botMessage,
    });
  }
  
  emitChatEvent(req, "session_updated", {
    sessionId: session._id.toString(),
    session: session,
  });

  res.status(200).json({
    status: "success",
    data: {
      session: session,
      ...(shouldBotRespond && {
        botResponse: botResponse.message,
        intent: botResponse.intent,
      }),
    },
  });
});

/**
 * Get chat history for a user
 * GET /api/v1/chat/history
 */
exports.getChatHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const sessions = await ChatSession.find({
    userId,
  })
    .sort({ lastActiveAt: -1 })
    .limit(10)
    .populate("userId", "fullName email");

  res.status(200).json({
    status: "success",
    results: sessions.length,
    data: sessions,
  });
});

/**
 * Get active chat session
 * GET /api/v1/chat/active
 */
exports.getActiveSession = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const session = await ChatSession.findOne({
    userId,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .populate("userId", "fullName email");

  if (!session) {
    return res.status(200).json({
      status: "success",
      data: {
        session: null,
      },
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      session: session,
    },
  });
});

/**
 * Close/Deactivate a chat session
 * PATCH /api/v1/chat/close/:sessionId
 */
exports.closeSession = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const session = await ChatSession.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
    },
    {
      isActive: false,
      status: "closed",
    },
    {
      new: true,
    }
  );

  if (!session) {
    return next(new AppError("Chat session not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Chat session closed",
    data: {
      session: session,
    },
  });
});

/**
 * Get all chat sessions (Admin only)
 * Returns only chats where the current admin is assigned (admin's own chats)
 * GET /api/v1/chat/admin/sessions
 */
exports.getAllSessions = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const adminId = req.user._id;

  const filter = {
    assignedAdmin: adminId, // Only show chats assigned to this admin
    initiatedByUser: true, // Only user-initiated chats
  };

  const { data: sessions, pagination } = await paginateQuery(ChatSession, filter, req, {
    queryModifier: (query) => query
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email")
      .populate("assignedAdmin", "fullName email"),
    defaultLimit: 50,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: sessions,
  });
});

/**
 * Get waiting chats that admins can join (Admin only)
 * Returns chats that are waiting for an admin but not yet assigned
 * GET /api/v1/chat/admin/waiting
 */
exports.getWaitingChats = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");

  const filter = {
    status: "waiting",
    isEscalated: true,
    assignedAdmin: null, // Not yet assigned to any admin
    initiatedByUser: true,
  };

  const { data: sessions, pagination } = await paginateQuery(ChatSession, filter, req, {
    queryModifier: (query) => query
      .sort({ escalatedAt: -1, createdAt: -1 })
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email"),
    defaultLimit: 50,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: sessions,
  });
});

/**
 * Get a specific chat session by ID (Admin only)
 * GET /api/v1/chat/admin/session/:id
 */
exports.getSessionById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const session = await ChatSession.findById(id)
    .populate("userId", "fullName email")
    .populate("driverId", "fullName email")
    .populate("assignedAdmin", "fullName email");

  if (!session) {
    return next(new AppError("Chat session not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: session,
  });
});

/**
 * Get a chat session for a specific user (Admin only)
 * Admins can only view existing user-initiated chats, they cannot create new ones
 * GET /api/v1/chat/admin/session/user/:userId
 */
exports.getSessionByUserId = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  // Find existing active session for this user (must be user-initiated)
  const session = await ChatSession.findOne({
    userId,
    isActive: true,
    initiatedByUser: true, // Only user-initiated chats
  })
    .sort({ createdAt: -1 })
    .populate("userId", "fullName email")
    .populate("assignedAdmin", "fullName email");

  if (!session) {
    return next(new AppError("No active chat session found for this user. Users must start the chat first.", 404));
  }

  // Assign admin to session if not already assigned (when admin joins)
  if (!session.assignedAdmin && session.status === "waiting") {
    session.assignedAdmin = req.user._id;
    if (session.status === "waiting") {
      session.status = "active";
    }
    await session.save();
    await session.populate("assignedAdmin", "fullName email");

    // Notify user that admin joined
    emitChatEvent(req, "adminJoined", {
      sessionId: session._id.toString(),
      session: session,
      admin: {
        fullName: session.assignedAdmin.fullName,
        email: session.assignedAdmin.email,
      },
    });
  }

  res.status(200).json({
    status: "success",
    data: session,
  });
});

/**
 * Escalate chat to human agent
 * POST /api/v1/chat/escalate/:sessionId
 */
exports.escalateChat = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const session = await ChatSession.findOne({
    _id: sessionId,
    userId,
    isActive: true,
  });

  if (!session) {
    return next(new AppError("Chat session not found", 404));
  }

  // Update session status
  session.status = "waiting";
  session.isEscalated = true;
  session.escalatedAt = new Date();

  // Add bot message about escalation
  session.messages.push({
    senderRole: "bot",
    message:
      "I've connected you with our support team. Please wait while an agent joins the conversation... 🧑‍💼",
    isBot: true,
    createdAt: new Date(),
  });

  session.lastMessage = "Waiting for agent...";
  session.lastMessageAt = new Date();
  await session.save();

  // Populate user data
  await session.populate("userId", "fullName email");

  // Notify all admins of new support request
  emitChatEvent(req, "newSupportRequest", {
    sessionId: session._id.toString(),
    session: session,
  });

  // Notify user
  emitChatEvent(req, "chatEscalated", {
    sessionId: session._id.toString(),
    session: session,
  });

  res.status(200).json({
    status: "success",
    message: "Chat escalated to support team",
    data: {
      session: session,
    },
  });
});

/**
 * Admin joins a chat session (picks up waiting chat)
 * POST /api/v1/chat/admin/join/:sessionId
 */
exports.adminJoinChat = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;
  const adminId = req.user._id;

  const session = await ChatSession.findById(sessionId);

  if (!session) {
    return next(new AppError("Chat session not found", 404));
  }

  // Update session
  session.status = "active";
  session.assignedAdmin = adminId;
  session.isEscalated = true;

  // Add system message
  session.messages.push({
    senderRole: "bot",
    message: "A support agent has joined the conversation. How can we help you today?",
    isBot: true,
    createdAt: new Date(),
  });

  session.lastMessage = "Agent joined";
  session.lastMessageAt = new Date();
  await session.save();

  // Populate user and admin data
  await session.populate("userId", "fullName email");
  await session.populate("assignedAdmin", "fullName email");

  // Notify user that admin joined
  emitChatEvent(req, "adminJoined", {
    sessionId: session._id.toString(),
    session: session,
    admin: {
      fullName: session.assignedAdmin.fullName,
      email: session.assignedAdmin.email,
    },
  });

  // Notify admins of status change
  emitChatEvent(req, "chatUpdate", {
    sessionId: session._id.toString(),
    session: session,
  });

  res.status(200).json({
    status: "success",
    message: "Successfully joined chat session",
    data: {
      session: session,
    },
  });
});

/**
 * Get all users that an admin has chatted with
 * GET /api/v1/chat/admin/users
 */
exports.getAdminUsers = catchAsync(async (req, res, next) => {
  const adminId = req.user._id;

  // Get all unique users that this admin has chatted with
  const sessions = await ChatSession.find({
    assignedAdmin: adminId,
    initiatedByUser: true,
  })
    .select("userId lastMessage lastMessageAt status createdAt")
    .populate("userId", "fullName email")
    .sort({ lastMessageAt: -1 });

  // Group by userId to get unique users with their latest chat info
  const userMap = new Map();
  sessions.forEach((session) => {
    const userId = session.userId._id.toString();
    if (!userMap.has(userId) || new Date(session.lastMessageAt) > new Date(userMap.get(userId).lastMessageAt)) {
      userMap.set(userId, {
        userId: session.userId,
        lastMessage: session.lastMessage,
        lastMessageAt: session.lastMessageAt,
        status: session.status,
        sessionId: session._id,
        chatCount: 0, // Will be calculated
      });
    }
  });

  // Count total chats per user
  sessions.forEach((session) => {
    const userId = session.userId._id.toString();
    if (userMap.has(userId)) {
      userMap.get(userId).chatCount += 1;
    }
  });

  const users = Array.from(userMap.values());

  res.status(200).json({
    status: "success",
    results: users.length,
    data: users,
  });
});

/**
 * Get all chat history between an admin and a specific user
 * GET /api/v1/chat/admin/user/:userId/history
 */
exports.getAdminUserHistory = catchAsync(async (req, res, next) => {
  const adminId = req.user._id;
  const { userId } = req.params;

  // Get all chat sessions between this admin and the specified user
  const sessions = await ChatSession.find({
    assignedAdmin: adminId,
    userId,
    initiatedByUser: true,
  })
    .sort({ createdAt: -1 })
    .populate("userId", "fullName email")
    .populate("assignedAdmin", "fullName email");

  res.status(200).json({
    status: "success",
    results: sessions.length,
    data: sessions,
  });
});

/**
 * Admin reply to a chat session
 * POST /api/v1/chat/admin/reply
 */
exports.adminReply = catchAsync(async (req, res, next) => {
  const { sessionId, message } = req.body;
  const adminId = req.user._id;

  if (!message || !message.trim()) {
    return next(new AppError("Message cannot be empty", 400));
  }

  if (!sessionId) {
    return next(new AppError("Session ID is required", 400));
  }

  const session = await ChatSession.findById(sessionId);

  if (!session) {
    return next(new AppError("Chat session not found", 404));
  }

  // Add admin message
  session.messages.push({
    senderRole: "admin",
    message: message.trim(),
    isBot: false,
    createdAt: new Date(),
  });

  // Update last message fields
  session.lastMessage = message.trim();
  session.lastMessageAt = new Date();
  session.lastActiveAt = new Date();

  // Assign admin to session if not already assigned
  if (!session.assignedAdmin) {
    session.assignedAdmin = adminId;
  }

  // If chat was waiting, mark it as active when admin replies
  if (session.status === "waiting") {
    session.status = "active";
  }

  // Save session
  await session.save();

  // Populate user data
  await session.populate("userId", "fullName email");
  await session.populate("assignedAdmin", "fullName email");

  // Emit socket events for real-time updates
  const adminMessage = session.messages[session.messages.length - 1];
  emitChatEvent(req, "new_message", {
    sessionId: session._id.toString(),
    session: session,
    message: adminMessage,
  });
  emitChatEvent(req, "session_updated", {
    sessionId: session._id.toString(),
    session: session,
  });

  res.status(200).json({
    status: "success",
    message: "Admin reply sent successfully",
    data: {
      session: session,
    },
  });
});

