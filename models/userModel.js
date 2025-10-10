const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // New address field
    address: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (dob) {
          const ageDiff = Date.now() - dob.getTime();
          const age = new Date(ageDiff).getUTCFullYear() - 1970;
          return age >= 18;
        },
        message: "User must be at least 18 years old.",
      },
    },
    // New favorite car field
    favouriteCar: {
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      year: { type: Number },
      color: { type: String, trim: true },
      licensePlate: { type: String, trim: true },
    },

    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },

    phoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    lastActive: { type: Date, default: Date.now },

    licenseNumber: { type: String },
    licenseImage: { type: String },
    licenseVerified: { type: Boolean, default: false },

    avatar: { type: String, default: null },
    drivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Driver" }],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Create OTP (hash before saving)
userSchema.methods.createOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpires = Date.now() + 3 * 60 * 1000; // 10 minutes
  console.log(this.otp);
  return otp; // raw OTP to send via SMS/Email
};

// Verify OTP
userSchema.methods.verifyOtp = function (enteredOtp) {
  const hashedOtp = crypto
    .createHash("sha256")
    .update(enteredOtp)
    .digest("hex");
  return this.otp === hashedOtp && this.otpExpires > Date.now();
};

// Compare password
userSchema.methods.correctPassword = async function (candidate, hashed) {
  return bcrypt.compare(candidate, hashed);
};

// 🔑 Check password change
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
