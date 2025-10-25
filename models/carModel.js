const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
 type: {
      type: String,
      enum: [
        "economy",
        "compact",
        "midsize",
        "standard",
        "fullsize",
        "luxury",
        "suv",
        "minivan",
        "convertible",
        "sports",
      ],
      // required: true,
    },
    make: {
      type: String,
      enum: [
        "Mercedes-Benz",
        "BMW",
        "Audi",
        "Toyota",
        "Honda",
        "Ford",
        "Chevrolet",
        "Nissan",
        "Volkswagen",
        "Hyundai",
      ],
      // required: true,
    },
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
        "EQC",
        "AMG GT",
      ],
      // required: true,
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
    extraMileRate: { type: Number, default: 0.5 },
    currentOdometer: { type: Number, default: 0, min: 0 },
    fuelLevel: { type: Number, default: 100, min: 0, max: 100 },
    fuelCapacity : { type: Number, default: 60 }, // in liters
    lastRented: Date,
    lastMaintenanceCheck: Date,
    rentalHistory: [
      {
        booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
        rentedAt: { type: Date, default: Date.now },
        odometerAtRental: Number,
        returnedAt: Date,
        odometerAtReturn: Number,
        fuelLevelAtReturn: Number,
        type: { type: String, enum: ["check-in", "check-out" ] },
      },
    ],

  
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

  
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    recentReviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Function to recalculate rating stats
function calculateRatingStats(doc) {
  if (!doc.recentReviews || doc.recentReviews.length === 0) {
    doc.averageRating = 0;
    doc.ratingCount = 0;
  } else {
    const total = doc.recentReviews.reduce(
      (sum, review) => sum + (review.rating || 0),
      0
    );
    doc.ratingCount = doc.recentReviews.length;
    doc.averageRating = parseFloat(
      (total / doc.ratingCount).toFixed(2) // rounded to 2 decimals
    );
  }
}


carSchema.pre("save", function (next) {
  if (this.isModified("recentReviews")) {
    calculateRatingStats(this);
  }
  next();
});


carSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  // If recentReviews array changed (pushed, pulled, replaced, etc.)
  if (update && update.$push?.recentReviews || update?.recentReviews || update?.$pull?.recentReviews) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      // Manually apply update before recalculating
      if (update.$push?.recentReviews) {
        docToUpdate.recentReviews.push(update.$push.recentReviews);
      } else if (update.$pull?.recentReviews) {
        docToUpdate.recentReviews = docToUpdate.recentReviews.filter(
          (r) => r._id.toString() !== update.$pull.recentReviews._id.toString()
        );
      } else if (update.recentReviews) {
        docToUpdate.recentReviews = update.recentReviews;
      }
      calculateRatingStats(docToUpdate);
      await docToUpdate.save();
    }
  }
  next();
});

carSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    console.log(`Car ${doc.model} deleted — ratings cleared.`);
  }
});


module.exports = mongoose.model("Car", carSchema);
