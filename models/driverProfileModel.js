const mongoose = require("mongoose");

/**
 * Driver Profile Model
 * For professional drivers who log in and accept ride requests
 * Links to User model via user field
 */
const driverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
    },
    // Driver type: always "professional" for logged-in drivers who accept ride requests
    driverType: {
      type: String,
      enum: ["rental", "professional"],
      default: "professional",
    },
    licenseImage: {
      type: String, // Cloudinary URL
      default: null,
    },
    insuranceImage: {
      type: String, // Cloudinary URL
      default: null,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    status: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "offline",
    },
    vehicleType: {
      type: String,
      enum: ["sedan", "suv", "luxury", "van"],
      default: "sedan",
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTrips: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    // Additional driver info
    licenseNumber: {
      type: String,
      trim: true,
    },
    licenseExpiry: {
      type: Date,
    },
    insuranceProvider: {
      type: String,
      trim: true,
    },
    insurancePolicyNumber: {
      type: String,
      trim: true,
    },
    insuranceExpiry: {
      type: Date,
    },
    // Verification status
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
// driverProfileSchema.index({ user: 1 }); // Removed - duplicate of unique index (unique: true on user field already creates this)
// driverProfileSchema.index({ status: 1 });
// driverProfileSchema.index({ verified: 1 });
// driverProfileSchema.index({ driverType: 1 });

// Update lastActive on status change
driverProfileSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status !== "offline") {
    this.lastActive = new Date();
  }
  next();
});

module.exports = mongoose.model("DriverProfile", driverProfileSchema);

