const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    fullName: { 
      type: String, 
      required: [true, "Full name is required"], 
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"]
    },
    phone: { 
      type: String, 
      required: [true, "Phone number is required"], 
      unique: true,
      trim: true,
    },
    email: { 
      type: String, 
      required: [true, "Email is required"], 
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
    },

    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    address: { type: String, trim: true },
      timeZone: {
    type: String,
    default: "America/Chicago", // fallback if detection fails
  },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (dob) {
          if (!dob) return true; // Optional field
          const ageDiff = Date.now() - dob.getTime();
          const age = new Date(ageDiff).getUTCFullYear() - 1970;
          return age >= 18;
        },
        message: "User must be at least 18 years old.",
      },
    },

    favouriteCar: {
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      year: { 
        type: Number,
        min: 1900,
        max: new Date().getFullYear() + 1
      },
      color: { type: String, trim: true },
      licensePlate: { 
        type: String, 
        trim: true,
        uppercase: true
      },
    },
    
    preferences: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Preference"
    },
    
    rentalStats: {
      totalRentals: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      firstRentalDate: { 
        type: Date 
      },
      lastRentalDate: { 
        type: Date 
      }
    },
    
    loyalty: {
      points: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      tier: { 
        type: String, 
        enum: ["bronze", "silver", "gold", "platinum"], 
        default: "bronze" 
      },
      memberSince: { 
        type: Date, 
        default: Date.now 
      }
    },

    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },

    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    
    status: { 
      type: String, 
      enum: ["active", "inactive", "suspended", "pending"], 
      default: "pending" 
    },
    
    lastActive: { type: Date, default: Date.now },
    avatar: { type: String, default: null },
    
    drivers: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Driver" 
    }],

    // Password reset fields
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetRequired: { type: Boolean, default: false },
    passwordChangedAt: Date, // Added for JWT token validation
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance


// Virtual for user age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const ageDiff = Date.now() - this.dateOfBirth.getTime();
  return new Date(ageDiff).getUTCFullYear() - 1970;
});

// Virtual for rental frequency (rentals per month)
userSchema.virtual('rentalStats.rentalsPerMonth').get(function() {
  if (!this.rentalStats.firstRentalDate) return 0;
  const now = new Date();
  const firstRental = new Date(this.rentalStats.firstRentalDate);
  const diffMonths = (now.getFullYear() - firstRental.getFullYear()) * 12 + 
                    (now.getMonth() - firstRental.getMonth());
  const tenureMonths = Math.max(1, diffMonths); // At least 1 month
  return this.rentalStats.totalRentals / tenureMonths;
});

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Set passwordChangedAt when password is modified
userSchema.pre("save", function(next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // Ensure token is created after
  next();
});

// Auto-update loyalty tier when rentals change
userSchema.pre("save", function(next) {
  if (this.isModified("rentalStats.totalRentals")) {
    this.updateLoyaltyTier();
  }
  next();
});

// Create OTP
userSchema.methods.createOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes (extended from 3)
  return otp;
};

// Verify OTP
userSchema.methods.verifyOtp = function (enteredOtp) {
  if (!this.otp || !this.otpExpires) return false;
  const hashedOtp = crypto.createHash("sha256").update(enteredOtp).digest("hex");
  return this.otp === hashedOtp && this.otpExpires > Date.now();
};

// Clear OTP after verification
userSchema.methods.clearOtp = function () {
  this.otp = undefined;
  this.otpExpires = undefined;
};

// Compare password
userSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

// Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Clear password reset token
userSchema.methods.clearPasswordResetToken = function () {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

// Update rental statistics
userSchema.methods.updateRentalStats = function() {
  const now = new Date();

  // Update first rental date if this is the first rental
  if (!this.rentalStats.firstRentalDate) {
    this.rentalStats.firstRentalDate = now;
  }
  
  // Update last rental date
  this.rentalStats.lastRentalDate = now;

  // Increment total rentals
  this.rentalStats.totalRentals += 1;

  // Update loyalty points (10 points per rental)
  this.loyalty.points += 10;

  return this.save();
};

// Update loyalty tier based on rental count
userSchema.methods.updateLoyaltyTier = function() {
  const totalRentals = this.rentalStats.totalRentals;

  if (totalRentals >= 20) {
    this.loyalty.tier = "platinum";
  } else if (totalRentals >= 10) {
    this.loyalty.tier = "gold";
  } else if (totalRentals >= 5) {
    this.loyalty.tier = "silver";
  } else {
    this.loyalty.tier = "bronze";
  }
  
  return this;
};

// Get rental summary
userSchema.methods.getRentalSummary = function() {
  return {
    totalRentals: this.rentalStats.totalRentals,
    firstRentalDate: this.rentalStats.firstRentalDate,
    lastRentalDate: this.rentalStats.lastRentalDate,
    rentalsPerMonth: this.rentalStats.rentalsPerMonth,
    loyaltyTier: this.loyalty.tier,
    loyaltyPoints: this.loyalty.points,
    memberSince: this.loyalty.memberSince
  };
};

// Check if user is active and verified
userSchema.methods.isActive = function () {
  return this.status === "active" && 
         this.phoneVerified && 
         this.emailVerified;
};

// Static method to find top renters
userSchema.statics.findTopRenters = function(limit = 10) {
  return this.find({ "rentalStats.totalRentals": { $gt: 0 } })
    .sort({ "rentalStats.totalRentals": -1 })
    .limit(limit)
    .select('fullName email phone rentalStats loyalty avatar');
};

module.exports = mongoose.model("User", userSchema);