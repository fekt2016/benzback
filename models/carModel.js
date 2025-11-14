const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    // Driver-based marketplace fields
    title: {
      type: String,
      trim: true,
      // Auto-generate from brand + model if not provided
    },
    // Driver reference (unique - one driver per car)
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      unique: true, // Enforce one-driver-one-car rule
    },
    
    // Car details
    make: {
      type: String,
      trim: true,
      required: true,
    },
    model: {
      type: String,
      trim: true,
      required: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1,
    },
    color: {
      type: String,
      trim: true,
    },
    
    // Hourly rate (required for hourly bookings)
    hourlyRate: {
      type: Number,
      min: 0,
      required: true,
    },
    
    // Car photos
    photos: [{
      type: String, // URLs to images
    }],
    
    // Car status
    status: {
      type: String,
      enum: ["available", "unavailable", "booked", "maintenance"],
      default: "available",
    },
    
    // Legacy fields for backward compatibility
    brand: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    availability: {
      type: String,
      enum: ["available", "unavailable", "booked"],
      default: "available",
    },
    geoLocation: {
      lat: {
        type: Number,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        min: -180,
        max: 180,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    
    // Legacy fields (maintained for backward compatibility)
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
   default: "UNknown",
    },
    // model and year moved above
    pricePerDay: { type: Number, required: false }, // Made optional for hourly-only bookings
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
    images: [String], // Legacy field - use photos instead
    // status moved above

   
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
          "Premium Sound System",
          "Remote Start",
          "Lane Assist",
          "Adaptive Cruise Control",
          "Wireless Charging"
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


// Auto-generate title from make + model if not provided
carSchema.pre("save", function (next) {
  if (this.isModified("recentReviews")) {
    calculateRatingStats(this);
  }
  
  // Auto-generate title if not provided
  if (!this.title && this.make && this.model) {
    this.title = `${this.make} ${this.model}`;
  }
  
  // Sync brand with make if brand not set (for backward compatibility)
  if (!this.brand && this.make) {
    this.brand = this.make;
  }
  
  // Sync images with photos if photos not set (for backward compatibility)
  if (this.images && this.images.length > 0 && (!this.photos || this.photos.length === 0)) {
    this.photos = this.images;
  }
  
  // Sync photos with images if images not set (for backward compatibility)
  if (this.photos && this.photos.length > 0 && (!this.images || this.images.length === 0)) {
    this.images = this.photos;
  }
  
  // Sync availability with status (for backward compatibility)
  if (this.status && !this.availability) {
    if (this.status === "available") {
      this.availability = "available";
    } else if (this.status === "booked") {
      this.availability = "booked";
    } else {
      this.availability = "unavailable";
    }
  }
  
  next();
});

// Indexes for marketplace queries
carSchema.index({ driver: 1 }, { unique: true }); // Unique index for one-driver-one-car
carSchema.index({ "geoLocation.lat": 1, "geoLocation.lng": 1 });
carSchema.index({ status: 1 });
carSchema.index({ availability: 1 }); // Legacy
carSchema.index({ hourlyRate: 1 });


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
