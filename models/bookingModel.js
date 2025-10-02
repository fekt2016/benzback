const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    pickupDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "license_required",
        "payment_pending",
        "cancelled",
        "verification_pending",
        "completed",
      ],
      default: "license required",
    },
    pickupLocation: {
      type: String,
      enum: [
        "Kansas City",
        "St. Louis",
        "Springfield",
        "Columbia",
        "Independence",
        "Lee's Summit",
        "O'Fallon",
        "St. Joseph",
        "St. Charles",
        "Blue Springs",
      ],
      required: true,
    },

    // ✅ Insurance verification

    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    pickupTime: { type: String, default: null },
    mileage: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
