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
    mileage: { type: Number, default: 0 },
    extraMileRate: { type: Number, default: 0.5 },
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

    // ⭐ Remove the embedded ratings array and keep only aggregated data
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
    // Optional: Store last few reviews for quick access
    recentReviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: Number,
        comment: String,
        createdAt: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Car", carSchema);
