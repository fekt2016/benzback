const mongoose = require("mongoose");

/**
 * ChatSession Model
 * Stores chat conversations between users and the BenzFlex support bot
 */
const messageSchema = new mongoose.Schema({
  senderRole: {
    type: String,
    enum: ["user", "bot", "admin"],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  isBot: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    messages: [messageSchema],
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["bot", "waiting", "active", "closed"],
      default: "bot",
    },
    isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    initiatedByUser: {
      type: Boolean,
      default: true, // All chats are user-initiated by default
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
chatSessionSchema.index({ userId: 1, isActive: 1 });
chatSessionSchema.index({ createdAt: -1 });
chatSessionSchema.index({ status: 1, lastMessageAt: -1 });
chatSessionSchema.index({ status: 1, isEscalated: 1 });
chatSessionSchema.index({ assignedAdmin: 1, lastMessageAt: -1 }); // For admin's chat history
chatSessionSchema.index({ assignedAdmin: 1, userId: 1 }); // For admin-user chat history

module.exports = mongoose.model("ChatSession", chatSessionSchema);

