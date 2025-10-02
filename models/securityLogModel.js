const mongoose = require("mongoose");

const securityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      refPath: "userTypeModel",
      default: null,
    },
    userTypeModel: {
      type: String,
      enum: ["Seller", "User", "Admin", "System"],
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        // Authentication Events
        "login_success",
        "login_failure",
        "logout",
        "session_timeout",
        "token_refresh",
        "token_revoked",
        "otp_sent",
        "otp_generated",
        "otp_request",

        // Password Events
        "password_reset_request",
        "password_reset_success",
        "password_reset_failure",
        "password_change",

        // Account Events
        "account_creation",
        "account_verification",
        "account_deactivation",
        "account_suspension",

        // Authorization Events
        "permission_denied",
        "role_change",
        "access_attempt",

        // Product Events
        "product_create",
        "product_update",
        "product_delete",
        "product_price_change",
        "product_stock_update",

        // Order Events
        "order_create",
        "order_update",
        "order_cancel",
        "order_refund",
        "order_status_change",

        // Payment Events
        "payment_attempt",
        "payment_success",
        "payment_failure",
        "refund_processed",

        // Inventory Events
        "inventory_update",
        "inventory_low_stock",
        "inventory_out_of_stock",

        // Seller Events
        "seller_application",
        "seller_approval",
        "seller_suspension",
        "seller_commission_change",
        "login_attempt",

        // Admin Events
        "admin_action",
        "system_config_change",
        "user_management",

        // Security Events
        "brute_force_attempt",
        "suspicious_activity",
        "api_rate_limit_exceeded",
        "data_export",
        "data_deletion",
        "otp_verification",
        "logout_attempt",
      ],
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      default: "info",
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    deviceInfo: {
      type: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "unknown"],
      },
      browser: String,
      os: String,
      platform: String,
    },
    status: {
      type: String,
      enum: ["success", "failure", "pending", "blocked"],
      default: "success",
    },
    resourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
    resourceType: {
      type: String,
      enum: ["Product", "Order", "User", "Seller", "Payment", "Inventory"],
      default: null,
    },
    description: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sessionId: {
      type: String,
      default: null,
    },
    affectedUsers: [
      {
        type: mongoose.Schema.ObjectId,
        refPath: "userTypeModel",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
securityLogSchema.index({ createdAt: -1 });
securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ eventType: 1, createdAt: -1 });
securityLogSchema.index({ severity: 1, createdAt: -1 });
securityLogSchema.index({ ipAddress: 1, createdAt: -1 });
securityLogSchema.index({ status: 1, createdAt: -1 });
securityLogSchema.index({ resourceType: 1, resourceId: 1 });

// Virtual for human-readable timestamp
securityLogSchema.virtual("timestamp").get(function () {
  return this.createdAt;
});

// Static methods for common queries
securityLogSchema.statics.findByUser = function (userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "name email");
};

securityLogSchema.statics.findRecentEvents = function (
  hours = 24,
  severity = null
) {
  const query = {
    createdAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
  };

  if (severity) {
    query.severity = severity;
  }

  return this.find(query).sort({ createdAt: -1 });
};

securityLogSchema.statics.getSecurityStats = function (days = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          eventType: "$eventType",
          severity: "$severity",
        },
        count: { $sum: 1 },
        failures: {
          $sum: { $cond: [{ $eq: ["$status", "failure"] }, 1, 0] },
        },
      },
    },
    {
      $sort: { "_id.date": -1, count: -1 },
    },
  ]);
};

// Instance method
securityLogSchema.methods.getFormattedLog = function () {
  return {
    id: this._id,
    timestamp: this.createdAt,
    user: this.user,
    userType: this.userTypeModel,
    event: this.eventType,
    severity: this.severity,
    ip: this.ipAddress,
    status: this.status,
    description: this.description,
    resource: this.resourceId
      ? {
          type: this.resourceType,
          id: this.resourceId,
        }
      : null,
  };
};

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);

module.exports = SecurityLog;
