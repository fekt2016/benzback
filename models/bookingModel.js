const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    // Booking Dates & Times
    pickupDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      required: true,
    },
    pickupTime: {
      type: String,
      default: "10:00 AM",
    },
    returnTime: {
      type: String,
      default: "10:00 AM",
    },
    actualPickupDate: {
      type: Date,
    },
    actualReturnDate: {
      type: Date,
    },

    // Pricing & Charges
    totalPrice: {
      type: Number,
      required: true,
    },
    basePrice: {
      type: Number,
      required: true,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    extraCharges: {
      type: Number,
      default: 0,
    },
    extraMiles: {
      type: Number,
      default: 0,
    },
    lateReturnFee: {
      type: Number,
      default: 0,
    },
    damageFee: {
      type: Number,
      default: 0,
    },
    cleaningFee: {
      type: Number,
      default: 0,
    },

    // Booking Status
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "pending_payment",
        "verification_pending",
        "license_required",
        "no_show",
        "overdue",
      ],
      default: "pending",
    },

    // Payment Information
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "partially_paid", "refunded", "failed"],
      default: "unpaid",
    },
    stripeSessionId: {
      type: String,
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "cash", "bank_transfer", "wallet"],
      default: "card",
    },

    // Location Information
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
    returnLocation: {
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
      default: function () {
        return this.pickupLocation; // Default to pickup location
      },
    },

    // Driver & Vehicle Details
    driverLicenses: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DriverLicense",
      default: null,
    },
    insurance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Insurance",
      default: null,
    },
    additionalDrivers: [
      {
        driver: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Driver",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Check-in Information
    checkInData: {
      checkInTime: {
        type: Date,
      },
      checkedInBy: {
        type: String,
        default: null,
      },
      checkedInAt: {
        type: Date,
      },
      odometerReading: {
        type: Number,
        min: 0,
      },
      fuelLevel: {
        type: Number,
        min: 0,
        max: 100,
      },
      exteriorPhotos: [
        {
          url: String,
          caption: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      interiorPhotos: [
        {
          url: String,
          caption: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      existingDamages: [
        {
          description: String,
          location: String,
          severity: {
            type: String,
            enum: ["minor", "moderate", "severe"],
          },
          photo: String,
          notedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      notes: {
        type: String,
        default: "",
      },
      agreementSigned: {
        type: Boolean,
        default: false,
      },
      agreementSignedAt: {
        type: Date,
      },
    },

    // Check-out Information
    checkOutData: {
      checkOutTime: {
        type: Date,
      },
      checkedOutBy: {
        type: String,
        default: null,
      },
      checkedOutAt: {
        type: Date,
      },
      odometerReading: {
        type: Number,
        min: 0,
      },
      fuelLevel: {
        type: Number,
        min: 0,
        max: 100,
      },
      exteriorPhotos: [
        {
          url: String,
          caption: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      interiorPhotos: [
        {
          url: String,
          caption: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      newDamages: [
        {
          description: String,
          location: String,
          severity: {
            type: String,
            enum: ["minor", "moderate", "severe"],
          },
          photo: String,
          repairCost: {
            type: Number,
            default: 0,
          },
          notedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      notes: {
        type: String,
        default: "",
      },
      cleaningRequired: {
        type: Boolean,
        default: false,
      },
      fuelCharge: {
        type: Number,
        default: 0,
      },
      mileageCharge: {
        type: Number,
        default: 0,
      },
    },

    // Mileage Information
    startMileage: {
      type: Number,
      min: 0,
    },
    endMileage: {
      type: Number,
      min: 0,
      default: null,
    },
    allowedMileage: {
      type: Number,
      default: 100, // miles per day
    },
    totalMileage: {
      type: Number,
      default: 0,
    },

    // Rental Terms
    rentalTerms: {
      mileageLimit: {
        type: Number,
        default: 100,
      },
      fuelPolicy: {
        type: String,
        enum: ["full-to-full", "pre-paid"],
        default: "full-to-full",
      },
      lateReturnFee: {
        type: Number,
        default: 50,
      },
      cleaningFee: {
        type: Number,
        default: 75,
      },
      damageDeposit: {
        type: Number,
        default: 500,
      },
    },

    // Status Tracking
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: String,
          required: true,
        },
        notes: {
          type: String,
          default: "",
        },
      },
    ],

    // Activity Log
    activityLog: [
      {
        action: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        performedBy: {
          type: String,
          required: true,
        },
        details: {
          type: mongoose.Schema.Types.Mixed,
        },
        ipAddress: {
          type: String,
        },
      },
    ],

    // Flags & Metadata
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationData: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      verifiedAt: {
        type: Date,
      },
      notes: {
        type: String,
      },
    },
    cancellationReason: {
      type: String,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ car: 1, pickupDate: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ pickupDate: 1, returnDate: 1 });

// Pre-save middleware to update updatedAt
bookingSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for booking duration in days
bookingSchema.virtual("durationDays").get(function () {
  return Math.ceil((this.returnDate - this.pickupDate) / (1000 * 60 * 60 * 24));
});

// Virtual for total amount due
bookingSchema.virtual("totalAmountDue").get(function () {
  return (
    this.totalPrice +
    this.extraCharges +
    this.taxAmount +
    this.lateReturnFee +
    this.damageFee +
    this.cleaningFee
  );
});

// Virtual to check if booking is active
bookingSchema.virtual("isActive").get(function () {
  return this.status === "active";
});

// Virtual to check if booking can be checked in
bookingSchema.virtual("canCheckIn").get(function () {
  const allowedStatuses = ["confirmed", "pending", "approved"];
  return allowedStatuses.includes(this.status);
});

// Virtual to check if booking is overdue
bookingSchema.virtual("isOverdue").get(function () {
  if (this.status !== "active") return false;
  return new Date() > this.returnDate;
});

// Instance method to update status with history
bookingSchema.methods.updateStatus = function (
  newStatus,
  changedBy,
  notes = ""
) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedBy: changedBy,
    notes: notes,
    timestamp: new Date(),
  });
  return this.save();
};

// Instance method for check-in
bookingSchema.methods.checkIn = function (checkInData) {
  this.status = "active";
  this.checkInData = {
    ...checkInData,
    checkedInAt: new Date(),
  };
  this.actualPickupDate = new Date();

  this.statusHistory.push({
    status: "active",
    changedBy: checkInData.checkedInBy || "system",
    notes: "Vehicle checked in",
    timestamp: new Date(),
  });

  return this.save();
};

// Instance method for check-out
bookingSchema.methods.checkOut = function (checkOutData) {
  this.status = "completed";
  this.checkOutData = {
    ...checkOutData,
    checkedOutAt: new Date(),
  };
  this.actualReturnDate = new Date();
  this.endMileage = checkOutData.odometerReading;

  // Calculate total mileage
  if (this.startMileage && checkOutData.odometerReading) {
    this.totalMileage = checkOutData.odometerReading - this.startMileage;
  }

  this.statusHistory.push({
    status: "completed",
    changedBy: checkOutData.checkedOutBy || "system",
    notes: "Vehicle checked out",
    timestamp: new Date(),
  });

  return this.save();
};

// Static method to find active bookings
bookingSchema.statics.findActive = function () {
  return this.find({ status: "active" })
    .populate("user", "name email phone")
    .populate("car", "model licensePlate");
};

// Static method to find bookings by date range
bookingSchema.statics.findByDateRange = function (startDate, endDate) {
  return this.find({
    $or: [
      { pickupDate: { $gte: startDate, $lte: endDate } },
      { returnDate: { $gte: startDate, $lte: endDate } },
      {
        $and: [
          { pickupDate: { $lte: startDate } },
          { returnDate: { $gte: endDate } },
        ],
      },
    ],
  });
};

module.exports = mongoose.model("Booking", bookingSchema);
