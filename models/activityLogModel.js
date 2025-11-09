const mongoose = require("mongoose");

/**
 * ActivityLog Model
 * Tracks all important user and driver actions in the system
 */
const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Can be null for system actions
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: false,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "driver", "admin", "executive", "system"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Can store any additional data (booking ID, driver ID, etc.)
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Additional metadata if needed
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for efficient queries
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ driverId: 1, createdAt: -1 });
activityLogSchema.index({ role: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, role: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);

