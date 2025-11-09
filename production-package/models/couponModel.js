const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // null means no max for percentage discounts
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableTo: {
      type: String,
      enum: ["all", "new_users", "existing_users", "specific_cars"],
      default: "all",
    },
    applicableCarIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
    }],
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
// couponSchema.index({ code: 1, isActive: 1 });
// couponSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.model("Coupon", couponSchema);

