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
      default: "System",
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "login_success",
        "login_failure",
        "logout",
        "session_timeout",
        "token_refresh",
        "token_revoked",
        "otp_sent",
        "otp_generated",
        "otp_request",
        "password_reset_request",
        "password_reset_success",
        "password_reset_failure",
        "password_change",
        "account_creation",
        "account_verification",
        "account_deactivation",
        "account_suspension",
        "permission_denied",
        "role_change",
        "access_attempt",
        "product_create",
        "product_update",
        "product_delete",
        "product_price_change",
        "product_stock_update",
        "order_create",
        "order_update",
        "order_cancel",
        "order_refund",
        "order_status_change",
        "payment_attempt",
        "payment_success",
        "payment_failure",
        "refund_processed",
        "inventory_update",
        "inventory_low_stock",
        "inventory_out_of_stock",
        "seller_application",
        "seller_approval",
        "seller_suspension",
        "seller_commission_change",
        "login_attempt",
        "admin_action",
        "system_config_change",
        "user_management",
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
    ipAddress: String,
    userAgent: String,
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
    resourceId: mongoose.Schema.ObjectId,
    resourceType: {
      type: String,
      enum: ["Product", "Order", "User", "Seller", "Payment", "Inventory"],
      default: null,
    },
    description: { type: String, default: "" },
    // ✅ keep metadata small
    metadata: { type: Map, of: String, default: {} },
    sessionId: String,
    affectedUsers: [
      { type: mongoose.Schema.ObjectId, refPath: "userTypeModel" },
    ],
  },
  {
    timestamps: true,
  }
);

/* ✅ Keep only essential indexes */
securityLogSchema.index({ createdAt: -1 });
securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ eventType: 1 });

/* ✅ Lightweight save method (auto-sanitizes metadata) */
securityLogSchema.statics.logEvent = async function (eventData) {
  try {
    const safeMetadata = {};
    if (eventData.metadata) {
      for (const key in eventData.metadata) {
        const value = eventData.metadata[key];
        if (["string", "number", "boolean"].includes(typeof value)) {
          safeMetadata[key] = value;
        } else {
          safeMetadata[key] = JSON.stringify(value).slice(0, 200); // truncate to 200 chars
        }
      }
    }

    const log = new this({
      ...eventData,
      metadata: safeMetadata,
    });

    await log.save();
  } catch (err) {
    console.error("⚠️ Failed to save security log:", err.message);
  }
};

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);
module.exports = SecurityLog;
