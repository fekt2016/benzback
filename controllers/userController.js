const User = require('../models/userModel')
const {catchAsync} = require("../utils/catchAsync")
const AppError = require('../utils/appError')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')



exports.getAllUsers = catchAsync(async (req, res, next) => {
  const paginateQuery = require("../utils/paginateQuery");
  const { role, search } = req.query;
  
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  
  const { data: users, pagination } = await paginateQuery(User, filter, req, {
    queryModifier: (query) => query.select("-password"),
    defaultLimit: 50,
    maxLimit: 100,
  });

  res.status(200).json({
    status: "success",
    ...pagination,
    data: users,
  });
});
exports.getUserById = catchAsync( async (req, res, next) => {
  const { id } = req.params;
  
  const user = await User.findById(id)
   
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// -------------------- CREATE USER --------------------
exports.createUser = catchAsync(async (req, res, next) => {
  const { fullName, email, phone, password, role } = req.body;
const admin = req.user.id
  // basic validation
  if (!fullName || !email || !password) {
    return next(new AppError("Please provide name, email, and password", 400));
  }

  // check if email already exists
   const existingUser = await User.findOne({
       $or: [{ email }, { phone: phone.replace(/\D/g, "") }],
     }).lean();

if(existingUser) {
    return next(new AppError('User already exist', 401))
}

  // create new user
  // Ensure role is either "user" or "admin" (valid enum values)
  const validRole = role && ["user", "admin"].includes(role) ? role : "user";
  
  const newUser = await User.create({
    fullName,
    email,
    phone,
    password,
    role: validRole,
    active: true,
  });

  res.status(201).json({
    status: "success",
    message: "User created successfully",
    data: {
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      createdBy: admin,
    },
  });
});

// -------------------- TOGGLE USER ROLE --------------------
exports.toggleUserRole = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  // Find the current user
  const user = await User.findById(userId);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  // Check if user is an executive (only executives can toggle roles)
  if (!user.executive) {
    return next(new AppError('Only executives can toggle roles', 403));
  }
  
  // Toggle role between "user" and "admin"
  const newRole = user.role === "user" ? "admin" : "user";
  
  // Update user role
  user.role = newRole;
  await user.save({ validateBeforeSave: false });
  
  // Generate new JWT token with updated role
  const { createSendToken } = require('../utils/createSendToken');
  
  // Send new token in response
  createSendToken(
    user,
    "Role updated successfully",
    200,
    res
  );
});

// -------------------- GET USER SETTINGS --------------------
exports.getSettings = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  const user = await User.findById(userId).select("settings");
  
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  
  // Return default settings if none exist
  const settings = user.settings || {
    emailNotifications: true,
    smsNotifications: false,
    bookingReminders: true,
    promotionalEmails: false,
    marketingEmails: false,
  };
  
  res.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
});

// -------------------- UPDATE USER SETTINGS --------------------
exports.updateSettings = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const {
    emailNotifications,
    smsNotifications,
    bookingReminders,
    promotionalEmails,
    marketingEmails,
  } = req.body;
  
  const user = await User.findById(userId);
  
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  
  // Validate that email exists if emailNotifications is true
  if (emailNotifications === true && !user.email) {
    return next(new AppError("Email address is required for email notifications", 400));
  }
  
  // Validate that phone exists if smsNotifications is true
  if (smsNotifications === true && !user.phone) {
    return next(new AppError("Phone number is required for SMS notifications", 400));
  }
  
  // Update settings
  user.settings = {
    emailNotifications: emailNotifications !== undefined ? emailNotifications : (user.settings?.emailNotifications ?? true),
    smsNotifications: smsNotifications !== undefined ? smsNotifications : (user.settings?.smsNotifications ?? false),
    bookingReminders: bookingReminders !== undefined ? bookingReminders : (user.settings?.bookingReminders ?? true),
    promotionalEmails: promotionalEmails !== undefined ? promotionalEmails : (user.settings?.promotionalEmails ?? false),
    marketingEmails: marketingEmails !== undefined ? marketingEmails : (user.settings?.marketingEmails ?? false),
  };
  
  await user.save({ validateBeforeSave: false });
  
  res.status(200).json({
    status: "success",
    message: "Settings updated successfully",
    data: {
      settings: user.settings,
    },
  });
});

// -------------------- DELETE USER ACCOUNT --------------------
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  const user = await User.findById(userId);
  
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  
  // Soft delete: Set status to inactive instead of actually deleting
  // This preserves data for business/legal purposes
  user.status = "inactive";
  user.email = `deleted_${Date.now()}_${user.email}`;
  user.phone = `deleted_${Date.now()}_${user.phone}`;
  user.fullName = "Deleted User";
  user.avatar = null;
  
  // Clear sensitive data
  user.password = crypto.randomBytes(32).toString("hex"); // Randomize password
  user.otp = undefined;
  user.otpExpires = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  
  await user.save({ validateBeforeSave: false });
  
  res.status(200).json({
    status: "success",
    message: "Account deleted successfully",
  });
});

// -------------------- FAVORITES / WISHLIST --------------------

/**
 * Get user favorites
 * GET /api/v1/users/favorites
 */
exports.getFavorites = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).populate("favorites", "-rentalHistory -__v");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    results: user.favorites?.length || 0,
    data: {
      favorites: user.favorites || [],
    },
  });
});

/**
 * Toggle favorite car
 * POST /api/v1/users/favorites/:carId
 */
exports.toggleFavorite = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { carId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if car exists
  const Car = require("../models/carModel");
  const car = await Car.findById(carId);
  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  // Initialize favorites array if it doesn't exist
  if (!user.favorites) {
    user.favorites = [];
  }

  const isFavorite = user.favorites.some(
    (fav) => fav.toString() === carId
  );

  if (isFavorite) {
    // Remove from favorites
    user.favorites = user.favorites.filter(
      (fav) => fav.toString() !== carId
    );
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Car removed from favorites",
      data: {
        isFavorite: false,
        favorites: user.favorites,
      },
    });
  } else {
    // Add to favorites
    user.favorites.push(carId);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Car added to favorites",
      data: {
        isFavorite: true,
        favorites: user.favorites,
      },
    });
  }
});

// -------------------- REFERRAL SYSTEM --------------------

/**
 * Get user referral info
 * GET /api/v1/users/referrals
 */
exports.getReferrals = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select("referralCode referralRewards");
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Generate referral code if doesn't exist
  if (!user.referralCode) {
    const generateReferralCode = () => {
      const prefix = user.fullName
        ? user.fullName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "BF";
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `${prefix}${random}`;
    };

    user.referralCode = generateReferralCode();
    await user.save({ validateBeforeSave: false });
  }

  // Get referral history
  const Referral = require("../models/referralModel");
  const referrals = await Referral.find({ referrer: userId })
    .populate("referred", "fullName email createdAt")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    data: {
      referralCode: user.referralCode,
      referralRewards: user.referralRewards || 0,
      referrals: referrals || [],
      shareLink: `${process.env.FRONTEND_URL || "https://benzflex.com"}/signup?ref=${user.referralCode}`,
    },
  });
});

/**
 * Redeem referral reward
 * POST /api/v1/users/referrals/redeem
 */
exports.redeemReferralReward = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { amount } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (!user.referralRewards || user.referralRewards < amount) {
    return next(new AppError("Insufficient referral rewards", 400));
  }

  // Deduct reward
  user.referralRewards -= amount;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Referral reward redeemed successfully",
    data: {
      remainingRewards: user.referralRewards,
      redeemedAmount: amount,
    },
  });
});

