// models/Notification.js
const mongoose = require("mongoose");

// models/Notification.js - Updated enum
const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "booking_confirmation",
        "booking_reminder",
        "payment_success",
        "payment_failed", // Add this
        "document_verification",
        "document_rejection", // Add this
        "booking_created", // Add this
        "booking_cancelled", // Add this
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    metadata: { type: Object },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
