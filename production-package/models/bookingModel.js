const mongoose = require("mongoose");
const { USA_TIME_ZONES } = require("../utils/dateTimeUtils");

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
    professionalDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver", // References unified Driver model with driverType: "professional"
      default: null,
    },
    // Real-time driver assignment fields
    driverAssigned: {
      type: Boolean,
      default: false,
    },
    driverRequestStatus: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'declined'],
      default: null,
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    acceptedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DriverProfile", // Reference to DriverProfile model for logged-in drivers
      default: null,
    },
    requestDriver: {
      type: Boolean,
      default: false,
    },
    driverServiceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
     timeZone: {
    type: String,
    default: 'America/Chicago', // Central Time for St. Louis
    enum: Object.values(USA_TIME_ZONES)
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
    rentalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    depositAmount: {
      type: Number,
      required: true,
      default: 150,
    },
  
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
    driverServiceTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    extraMiles: {
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
        "in_progress",
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
      enum: ["stripe"],
      default: "stripe",
    },

    // Location Information
    pickupLocation: {
      type: String,
      enum: [
        
        "St. Louis",
      
      ],
      required: true,
    },
    returnLocation: {
      type: String,
      enum: [
       
        "St. Louis",
        
      ],
      default: function () {
        return this.pickupLocation; // Default to pickup location
      },
    },
    startMileage: {
      type: Number,
      min: 0,
    },
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
      },
      checkInImages: [String],
      notes: {
        type: String,
        default: "",
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
      cleaningRequired: {
        type: Boolean,
        default: false,
      },
      fuelCharge: {
        type: Number,
        default: 0,
      },
      allowedMileage: {
      type: Number,
      default: 200,
    },
      extraMileageCharge: {
        type: Number,
        default: 0,
      },
     endMileage: {
      type: Number,
      min: 0,
      default: null,
    },
    totalAdditionalCharges:{
      type: Number,
      default: 0,
    },
    totalMileageUsed: {
      type: Number,
      default: 0,
    },
    mileageDifference: {
      type: Number,
      default: 0,
    },
     Photos: [
        {
          url: String,
          caption: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
       notes: {
        type: String,
        default: "",
      },
    },
    // Rental Terms
    rentalTerms: {
      agreementSigned: {
        type: Boolean,
        default: false,
      },
      mileageLimit: {
        type: Number,
        default: 200,
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
        default: 150,
      },
    },
    // Status Tracking
    statusHistory: [
      {
        type: { type: String, enum: ["check-in", "check-out" ] },
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
          default: "system",
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
    // isVerified: {
    //   type: Boolean,
    //   default: false,
    // },
    // verificationData: {
    //   verifiedBy: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    //   verifiedAt: {
    //     type: Date,
    //   },
    //   notes: {
    //     type: String,
    //   },
    // },
    // cancellationReason: {
    //   type: String,
    // },
    // cancelledBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    // },
    // cancelledAt: {
    //   type: Date,
    // },

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
