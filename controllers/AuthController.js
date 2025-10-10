const { validateUSPhone } = require("../utils/helper");
const catchAsync = require("../utils/catchAsync");
const { generateOTP } = require("../utils/OtpSystem");
const crypto = require("crypto");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { createSendToken } = require("../utils/createSendToken");
const validator = require("validator");
const { isPublicRoute } = require("../utils/publicRoute");
const { extractToken, verifyToken } = require("../utils/tokenService");

exports.signup = catchAsync(async (req, res, next) => {
  //get form fields from the body
  const { fullName, phone, password, passwordConfirm, email } = req.body;

  let currentPhone = phone.replace(/\D/g, "");

  // 2️⃣ If number starts with "1" (e.g., +1XXXXXXXXXX or 1XXXXXXXXXX), remove it
  if (currentPhone.length === 11 && currentPhone.startsWith("1")) {
    currentPhone = currentPhone.slice(1);
  }

  if (!currentPhone || !validateUSPhone(currentPhone)) {
    return next(new AppError("Please provide a valid US phone number", 400));
  }

  if (!password || !passwordConfirm) {
    return next(
      new AppError(
        "Please provide both password and password confirmation",
        400
      )
    );
  }
  if (password !== passwordConfirm) {
    return next(new AppError("Passwords do not match", 400));
  }
  if (!email) {
    return next(new AppError("Email is required for OTP verification", 400));
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { phone: currentPhone.replace(/\D/g, "") }],
  });
  console.log(existingUser);

  if (existingUser) {
    return next(
      new AppError("User with this email or phone already exists", 400)
    );
  }

  const otp = generateOTP();
  const otpExpires = Date.now() + 10 * 60 * 10000;
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  const newUser = await User.create({
    fullName,
    email,
    phone: currentPhone.replace(/\D/g, ""),
    password,
    passwordConfirm,
    otp: hashedOtp,
    otpExpires,
    phoneVerified: false,
  });

  try {
  } catch (err) {
    console.log(err);
    return next(
      new AppError("Account created but failed to send OTP SMS", 500)
    );
  }
  res.status(200).json({
    status: "success",
    message: "Account created! Please verify with the OTP sent to your phone",
    data: {
      user: {
        id: newUser._id,
        name: newUser.fullName,
        phone: newUser.phone,
        email,
      },
      otp: otp,
    },
  });
});
exports.verifyOtp = catchAsync(async (req, res, next) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return next(new AppError("Please provide phone and OTP", 400));
  }
  const normalizedPhone = phone.replace(/\D/g, "");
  const user = await User.findOne({ phone: normalizedPhone }).select(
    "+otp +otpExpires"
  );
  if (!user) {
    return next(new AppError("No user found with that phone number", 404));
  }
  if (!user.verifyOtp(otp)) {
    return next(new AppError("OTP is invalid or has expired", 401));
  }
  user.otp = undefined;
  user.otpExpires = undefined;

  let verificationContext = "login";
  let message = "Logged in successfully";
  if (user.status === "inactive" && !user.phoneVerified) {
    user.status = "active";
    user.phoneVerified = true;
    verificationContext = "signup";
    message = "Phone verified successfully! Your account is now active";
  }

  user.lastActive = new Date();
  user.verificationContext = verificationContext;
  await user.save({ validateBeforeSave: false });
  createSendToken(user, message, 200, res);
});
exports.login = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;

  const curphone = phone.replace(/\D/g, "");
  console.log(curphone);
  // 1. Validate phone input
  if (!curphone) {
    return next(new AppError("Please enter your phone number", 400));
  }
  if (!validator.isMobilePhone(curphone)) {
    return next(new AppError("Please enter a valid phone number", 400));
  }

  // 2. Find user
  const user = await User.findOne({ phone: curphone }).select("+password");

  // 3. Check if user exists
  if (!user) {
    return next(new AppError("Invalid phone number or password", 401));
  }

  // 4. Validate password
  if (!password) {
    return next(new AppError("Please enter your password", 400));
  }

  const isPasswordCorrect = await user.correctPassword(password, user.password);
  if (!isPasswordCorrect) {
    return next(new AppError("Invalid phone number or password", 401));
  }

  // 5. Generate OTP and save user
  const otp = user.createOtp();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "OTP sent to your phone number!",
    email: user.email,
    name: user.name,
    otp,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token from cookies or Authorization header
  const token = extractToken(req);

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 2) Verify token
  const { decoded, error } = verifyToken(token);
  if (error) {
    return next(
      new AppError("Invalid or expired token. Please log in again.", 401)
    );
  }

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401)
    );
  }

  // 4) Attach user to request for access in controllers
  req.user = currentUser;

  next();
});
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -__v");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { user },
  });
});
exports.logout = catchAsync(async (req, res, next) => {
  const token = extractToken(req);

  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  const successResponse = {
    status: "success",
    message: "Logged out successfully",
    action: "clearLocalStorage",
  };
  if (!token) {
    return res.status(200).json(successResponse);
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(200).json(successResponse);
  }

  const user = await User.findOne({ _id: decoded.id });
  if (!user) {
    return res.status(200).json(successResponse);
  }

  try {
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Add the token to the blacklist
    // const black = await TokenBlacklist.create({
    //   token,
    //   user: decoded.id,
    //   userType: "user",
    //   expiresAt,
    //   reason: "logout",
    // });

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error("Logout processing error:", error);

    // Handle duplicate key error (if the same token is being blacklisted again)
    if (error.code === 11000) {
      return res.status(200).json(successResponse);
    }

    // Log the error

    return res.status(200).json({
      ...successResponse,
      message: "Logged out with minor issues",
    });
  }
});
exports.resendOtp = catchAsync(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new AppError("Phone number is required", 400));
  }

  const user = await User.findOne({ phone });
  if (!user) {
    return next(new AppError("No user found with this phone number", 404));
  }

  // Generate OTP directly in controller
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const otpExpires = new Date(Date.now() + 3 * 60 * 1000);

  console.log("🆕 Generated OTP:", {
    plain: otp,
    hashed: hashedOtp,
    expires: otpExpires,
  });

  // Update using findByIdAndUpdate (more reliable)
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      otp: hashedOtp,
      otpExpires: otpExpires,
    },
    {
      new: true, // Return updated document
      runValidators: false,
    }
  ).select("+otp +otpExpires");

  res.status(200).json({
    status: "success",
    message: "New OTP has been sent to your phone",
    loginId: user._id,
    otp,
  });
});
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { fullName, email, phone, dateOfBirth, address } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, {
    fullName,
    email,
    phone,
    dateOfBirth,
    address,
  });
  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    data: {
      user,
    },
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError("No user found with that email", 404));
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // send email logic here
  await sendEmail({
    to: user.email,
    subject: "Your password reset link",
    text: `Click here to reset: ${req.protocol}://${req.get(
      "host"
    )}/reset/${resetToken}`,
  });

  res.status(200).json({
    status: "success",
    message: "Password reset link sent!",
  });
});
exports.resetPassword = catchAsync(async (req, res, next) => {});
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return next(
      new AppError("Please provide current password and new password", 400)
    );
  }
  if (newPassword !== newPasswordConfirm) {
    return next(
      new AppError("New password and confirm password do not match", 400)
    );
  }
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    return next(new AppError("No user found with that id", 404));
  }
  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError("Current password is incorrect", 401));
  }
  user.password = newPassword;

  await user.save();
  res.status(200).json({
    status: "success",
    message: "Password updated successfully",
  });
  if (user.passwordChangedAt) {
    user.passwordChangedAt = Date.now() - 1000;
  }
});
exports.uploadAvatar = catchAsync(async (req, res, next) => {
  console.log(req.body);
  const { avatar } = req.body;
  if (!avatar) {
    return next(new AppError("Please provide avatar", 400));
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError("No user found with that id", 404));
  }

  user.avatar = avatar;
  await user.save();
  res.status(200).json({
    status: "success",
    message: "Avatar updated successfully",
  });
});
