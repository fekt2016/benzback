const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    series: {
      type: String,
      enum: [
        "A-Class",
        "B-Class",
        "C-Class",
        "E-Class",
        "S-Class",
        "CLA",
        "CLS",
        "GLA",
        "GLB",
        "GLC",
        "GLE",
        "GLS",
        "G-Class",
        "EQC", // Electric
        "AMG GT",
      ],
      required: true,
    },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    licensePlate: { type: String, required: true, unique: true },
    transmission: {
      type: String,
      enum: ["manual", "automatic"],
      default: "automatic",
    },
    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "electric", "hybrid"],
      default: "petrol",
    },
    seats: { type: Number, default: 4 },
    images: [String],
    status: {
      type: String,
      enum: ["available", "rented", "maintenance"],
      default: "available",
    },
    pickupWindow: {
      start: { type: String, default: "08:00" },
      end: { type: String, default: "18:00" },
    },

    // ⭐ Car Features
    features: [
      {
        type: String,
        enum: [
          "Air Conditioning",
          "Bluetooth",
          "GPS Navigation",
          "Sunroof",
          "Heated Seats",
          "Backup Camera",
          "Parking Sensors",
          "Cruise Control",
          "Leather Seats",
          "Apple CarPlay",
          "Android Auto",
          "All-Wheel Drive",
          "Keyless Entry",
          "USB Charger",
          "Child Seat",
        ],
      },
    ],

    // ⭐ Rating system
    ratings: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
          required: true,
        },
        review: {
          type: String,
          trim: true,
        },
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// 🔹 Middleware to auto-calc average rating
carSchema.methods.updateRatingStats = function () {
  if (this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = sum / this.ratings.length;
    this.ratingCount = this.ratings.length;
  } else {
    this.averageRating = 0;
    this.ratingCount = 0;
  }
};

module.exports = mongoose.model("Car", carSchema);
