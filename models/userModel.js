const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6, select: false },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        // Only works on CREATE and SAVE
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords do not match",
      },
      select: false, // do not persist
    },

    role: { type: String, enum: ["user", "admin"], default: "user" },

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
  this.passwordConfirm = undefined; // never save confirm
  next();
});

// Create OTP
userSchema.methods.createOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpires = Date.now() + 10 * 60 * 1000;
  return otp;
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
  return await bcrypt.compare(candidate, hashed);
};

module.exports = mongoose.model("User", userSchema);
