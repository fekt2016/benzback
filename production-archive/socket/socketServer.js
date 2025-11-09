const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Driver = require("../models/driverModel");
const ChatSession = require("../models/chatSessionModel");
const { initializeDriverSocketHandlers } = require("./driverSocketHandler");

// Import bot response logic from chat controller
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

// Track online users: Map<userId, { userId, socketId, role, connectedAt, userInfo }>
const onlineUsers = new Map();

/**
 * Get online users list (for admins)
 * MEMORY OPTIMIZATION: Uses lean() and limits fields to reduce memory usage
 */
const getOnlineUsers = async () => {
  const users = [];
  // MEMORY OPTIMIZATION: Process in smaller chunks to avoid loading all users at once
  const userIds = Array.from(onlineUsers.keys());
  
  // Process in batches of 20 to prevent memory spikes
  const batchSize = 20;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const userPromises = batch.map(async (userId) => {
      try {
        const data = onlineUsers.get(userId);
        // MEMORY OPTIMIZATION: Use lean() and select only needed fields
        const user = await User.findById(userId).select("fullName email role").lean();
        if (user) {
          return {
            userId: user._id.toString(),
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            connectedAt: data.connectedAt,
            socketId: data.socketId,
          };
        }
      } catch (error) {
        console.error(`[OnlineUsers] Error fetching user ${userId}:`, error);
        // Remove stale entry if user doesn't exist
        onlineUsers.delete(userId);
      }
      return null;
    });
    
    const batchResults = await Promise.all(userPromises);
    users.push(...batchResults.filter(Boolean));
  }
  
  return users;
};

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.io server instance
 */
const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user
      const user = await User.findById(decoded.id).select("role");
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.userId = decoded.id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`[Socket] User connected: ${socket.userId} (${socket.userRole})`);

    // Track online user
    if (socket.userId && socket.userRole !== "admin") {
      onlineUsers.set(socket.userId.toString(), {
        userId: socket.userId.toString(),
        socketId: socket.id,
        role: socket.userRole,
        connectedAt: new Date(),
      });

      // Notify admins of new online user
      const user = await User.findById(socket.userId).select("fullName email role");
      if (user) {
        io.to("adminRoom").emit("userOnline", {
          userId: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          connectedAt: new Date(),
        });
      }
    }

    // Join role-based rooms
    if (socket.userRole === "driver") {
      socket.join("drivers");
      socket.join(`driver:${socket.userId}`);
      console.log(`[Socket] Driver ${socket.userId} joined drivers room`);
    } else if (socket.userRole === "user") {
      socket.join(`user:${socket.userId}`);
      console.log(`[Socket] User ${socket.userId} joined user room`);
    } else if (socket.userRole === "admin" || socket.userRole === "executive") {
      socket.join("admin");
      socket.join("adminRoom");
      socket.join("adminActivityRoom"); // Auto-join activity room for admins
      console.log(`[Socket] Admin ${socket.userId} joined admin room and activity room`);
    }

    // ========== CHAT SOCKET HANDLERS ==========
    
    // Join a chat session room (alias for joinChat for compatibility)
    socket.on("joinChat", (sessionId) => {
      if (!sessionId) {
        socket.emit("chat_error", { message: "Session ID is required" });
        return;
      }
      socket.join(`chat:${sessionId}`);
      console.log(`[Chat] User ${socket.userId} joined chat room: ${sessionId}`);
      socket.emit("chat_joined", { sessionId });
    });

    // Join a chat session room (new event name)
    socket.on("joinRoom", (sessionId) => {
      if (!sessionId) {
        socket.emit("chat_error", { message: "Session ID is required" });
        return;
      }
      socket.join(`chat:${sessionId}`);
      console.log(`🧩 [Chat] User ${socket.userId} joined room: ${sessionId}`);
      socket.emit("room_joined", { sessionId });
    });

    // Admin joins global admin room to monitor all chats
    socket.on("joinAdminRoom", async () => {
      if (socket.userRole === "admin" || socket.userRole === "executive") {
        socket.join("adminRoom");
        socket.join("adminActivityRoom"); // Also join activity room
        console.log(`👑 [Chat] Admin ${socket.userId} joined adminRoom and adminActivityRoom`);
        socket.emit("admin_room_joined");
        
        // Send current online users to admin
        const users = await getOnlineUsers();
        socket.emit("onlineUsers", users);
      } else {
        socket.emit("chat_error", { message: "Only admins can join admin room" });
      }
    });

    // Admin requests online users
    socket.on("getOnlineUsers", async () => {
      if (socket.userRole === "admin") {
        const users = await getOnlineUsers();
        socket.emit("onlineUsers", users);
      } else {
        socket.emit("chat_error", { message: "Only admins can request online users" });
      }
    });

    // Handle explicit chat escalation from user
    socket.on("escalateChat", async (sessionId) => {
      try {
        if (!sessionId) {
          socket.emit("chat_error", { message: "Session ID is required" });
          return;
        }

        // Verify user has access to this session
        const session = await ChatSession.findById(sessionId);
        if (!session) {
          socket.emit("chat_error", { message: "Chat session not found" });
          return;
        }

        // Verify it's the session owner
        if (session.userId.toString() !== socket.userId.toString()) {
          socket.emit("chat_error", { message: "Unauthorized access to this session" });
          return;
        }

        // Only escalate if not already escalated
        if (!session.isEscalated) {
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
          io.to("adminRoom").emit("newSupportRequest", {
            sessionId: session._id.toString(),
            session: session,
            userId: session.userId,
            lastMessage: session.lastMessage,
            escalatedAt: session.escalatedAt,
          });

          // Notify user
          io.to(`chat:${sessionId}`).emit("chatEscalated", {
            sessionId: session._id.toString(),
            session: session,
          });

          console.log(`🚨 [Chat] User ${socket.userId} escalated chat ${sessionId}`);
        }
      } catch (error) {
        console.error("[Chat] Error handling escalateChat:", error);
        socket.emit("chat_error", { message: "Failed to escalate chat" });
      }
    });

    // Handle incoming messages via socket
    socket.on("sendMessage", async ({ sessionId, senderRole, message }) => {
      try {
        if (!sessionId || !message || !message.trim()) {
          socket.emit("chat_error", { message: "Session ID and message are required" });
          return;
        }

        // Verify user has access to this session
        const session = await ChatSession.findById(sessionId);
        if (!session) {
          socket.emit("chat_error", { message: "Chat session not found" });
          return;
        }

        // Verify permissions
        if (senderRole === "user" && session.userId.toString() !== socket.userId.toString()) {
          socket.emit("chat_error", { message: "Unauthorized access to this session" });
          return;
        }

        if (senderRole === "admin" && socket.userRole !== "admin") {
          socket.emit("chat_error", { message: "Only admins can send admin messages" });
          return;
        }

        // Add message to session
        const newMsg = {
          senderRole,
          message: message.trim(),
          isBot: senderRole === "bot",
          createdAt: new Date(),
        };

        session.messages.push(newMsg);
        session.lastMessage = message.trim();
        session.lastMessageAt = new Date();
        session.lastActiveAt = new Date();

        // If admin replies, assign admin to session and update status
        if (senderRole === "admin") {
          if (!session.assignedAdmin) {
            session.assignedAdmin = socket.userId;
          }
          // If chat was waiting, mark it as active
          if (session.status === "waiting") {
            session.status = "active";
          }
        }

        // Bot should ONLY respond to USER messages, and ONLY when:
        // 1. Chat status is "bot" (not escalated)
        // 2. No admin is assigned
        // 3. Chat is not escalated
        const shouldBotRespond = 
          senderRole === "user" && 
          session.status === "bot" && 
          !session.isEscalated && 
          !session.assignedAdmin;

        if (shouldBotRespond) {
          const botResponse = getBotResponse(message);
          const botMsg = {
            senderRole: "bot",
            message: botResponse.message,
            isBot: true,
            createdAt: new Date(),
          };
          session.messages.push(botMsg);
          session.lastMessage = botResponse.message;
          session.lastMessageAt = new Date();

          // Check if bot response indicates escalation
          if (botResponse.shouldEscalate) {
            session.status = "waiting";
            session.isEscalated = true;
            session.escalatedAt = new Date();
            
            // Notify all admins of new support request
            io.to("adminRoom").emit("newSupportRequest", {
              sessionId: session._id.toString(),
              session: session,
            });

            // Notify user
            io.to(`chat:${sessionId}`).emit("chatEscalated", {
              sessionId: session._id.toString(),
              session: session,
            });
          }
        }

        // Notify admins when a new user-initiated chat is created (if not already escalated)
        // Admins automatically see chats once they're started by users
        if (session.initiatedByUser && !session.isEscalated && session.status === "bot") {
          // Notify admins that a new user chat has started (they can monitor it)
          io.to("adminRoom").emit("userChatStarted", {
            sessionId: session._id.toString(),
            session: session,
            userId: session.userId,
          });
        }

        await session.save();

        // Populate user data for response
        await session.populate("userId", "fullName email");
        if (session.assignedAdmin) {
          await session.populate("assignedAdmin", "fullName email");
        }

        // Broadcast the user/admin message to all clients in the same room
        io.to(`chat:${sessionId}`).emit("newMessage", {
          sessionId,
          senderRole: newMsg.senderRole,
          message: newMsg.message,
          isBot: newMsg.isBot,
          createdAt: newMsg.createdAt,
        });

        // If bot responded, broadcast bot response separately
        // Check the last message in the array to see if it's a bot message
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.senderRole === "bot" && lastMessage !== newMsg) {
          io.to(`chat:${sessionId}`).emit("newMessage", {
            sessionId,
            senderRole: "bot",
            message: lastMessage.message,
            isBot: true,
            createdAt: lastMessage.createdAt,
          });
        }

        // Notify admins of chat updates (only if chat is escalated)
        if (session.isEscalated || session.status !== "bot") {
          io.to("adminRoom").emit("chatUpdate", {
            sessionId,
            lastMessage: message.trim(),
            user: session.userId,
            time: new Date(),
            session: session,
          });
        }

        console.log(`💬 [Chat] Message sent in room ${sessionId} by ${senderRole}`);
      } catch (error) {
        console.error("[Chat] Error handling sendMessage:", error);
        socket.emit("chat_error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicators
    socket.on("typing", ({ sessionId, isTyping }) => {
      if (sessionId) {
        socket.to(`chat:${sessionId}`).emit("userTyping", {
          sessionId,
          userId: socket.userId,
          isTyping,
        });
      }
    });

    // Leave a chat session room
    socket.on("leaveChat", (sessionId) => {
      if (sessionId) {
        socket.leave(`chat:${sessionId}`);
        console.log(`[Chat] User ${socket.userId} left chat room: ${sessionId}`);
      }
    });

    socket.on("leaveRoom", (sessionId) => {
      if (sessionId) {
        socket.leave(`chat:${sessionId}`);
        console.log(`[Chat] User ${socket.userId} left room: ${sessionId}`);
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`[Socket] User disconnected: ${socket.userId}`);
      
      // Remove from online users
      if (socket.userId && onlineUsers.has(socket.userId.toString())) {
        onlineUsers.delete(socket.userId.toString());
        
        // Notify admins of user going offline
        io.to("adminRoom").emit("userOffline", {
          userId: socket.userId.toString(),
        });
      }
    });
  });

  // Initialize driver-specific socket handlers
  initializeDriverSocketHandlers(io);

  // MEMORY OPTIMIZATION: Periodic cleanup of stale onlineUsers entries
  // Clean up entries older than 1 hour (in case disconnect event wasn't fired)
  const cleanupInterval = setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleanedCount = 0;
    
    for (const [userId, data] of onlineUsers.entries()) {
      if (data.connectedAt && new Date(data.connectedAt).getTime() < oneHourAgo) {
        onlineUsers.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Socket] Cleaned up ${cleanedCount} stale online user entries`);
    }
  }, 30 * 60 * 1000); // Run every 30 minutes

  // Store cleanup interval for graceful shutdown
  io.on('close', () => {
    clearInterval(cleanupInterval);
  });

  return io;
};

module.exports = { initializeSocket };

