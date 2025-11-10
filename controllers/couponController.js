const { catchAsync } = require("../utils/catchAsync");
const Coupon = require("../models/couponModel");
const AppError = require("../utils/appError");

/**
 * Validate and apply coupon code
 * POST /api/v1/coupons/validate
 */
exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, bookingTotal } = req.body;

  if (!code) {
    return next(new AppError("Coupon code is required", 400));
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });

  if (!coupon) {
    return next(new AppError("Invalid or expired coupon code", 404));
  }

  // Check if coupon is within validity period
  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return next(new AppError("Coupon code has expired", 400));
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return next(new AppError("Coupon code has reached its usage limit", 400));
  }

  // Check minimum purchase amount
  if (bookingTotal && bookingTotal < coupon.minPurchaseAmount) {
    return next(
      new AppError(
        `Minimum purchase amount of $${coupon.minPurchaseAmount} required`,
        400
      )
    );
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (bookingTotal || 0) * (coupon.discountValue / 100);
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  // Ensure discount doesn't exceed booking total
  discountAmount = Math.min(discountAmount, bookingTotal || 0);

  res.status(200).json({
    status: "success",
    data: {
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Math.round(discountAmount * 100) / 100,
        maxDiscountAmount: coupon.maxDiscountAmount,
      },
    },
  });
});

/**
 * Get all active coupons (admin only)
 * GET /api/v1/coupons
 */
exports.getAllCoupons = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  
  const filter = { isActive: true };

  const { data: coupons, pagination } = await paginateQuery(Coupon, filter, req, {
    queryModifier: (query) => query.sort({ createdAt: -1 }).select("-__v"),
    defaultLimit: 20,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: {
      coupons,
    },
  });
});

/**
 * Create coupon (admin only)
 * POST /api/v1/coupons
 */
exports.createCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minPurchaseAmount,
    maxDiscountAmount,
    validFrom,
    validUntil,
    usageLimit,
    applicableTo,
    applicableCarIds,
  } = req.body;

  // Validate required fields
  if (!code || !description || !discountType || !discountValue) {
    return next(
      new AppError(
        "Please provide code, description, discountType, and discountValue",
        400
      )
    );
  }

  // Check if code already exists
  const existingCoupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
  });

  if (existingCoupon) {
    return next(new AppError("Coupon code already exists", 400));
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase().trim(),
    description,
    discountType,
    discountValue,
    minPurchaseAmount: minPurchaseAmount || 0,
    maxDiscountAmount: maxDiscountAmount || null,
    validFrom: validFrom || new Date(),
    validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    usageLimit: usageLimit || null,
    applicableTo: applicableTo || "all",
    applicableCarIds: applicableCarIds || [],
  });

  res.status(201).json({
    status: "success",
    message: "Coupon created successfully",
    data: {
      coupon,
    },
  });
});

