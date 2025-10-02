const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const TokenBlacklist = require("../models/tokenBlacklistModel"); // if you’re using one
const User = require("../models/userModel");
const { validateUSPhone } = require("../utils/helper");
const securityLogService = require("../utils/securityLogService");
const { generateOTP } = require("../utils/otpService");
const { verifyToken, extractToken } = require("../utils/tokenService");
const { createSendToken } = require("../utils/createSendToken");
const validator = require("validator");
const crypto = require("crypto");
const { isPublicRoute } = require("../utils/PublicRoute");
const twilioService = require("../service/twilio");
// Utility: Extract Bearer token

exports.signup = catchAsync(async (req, res, next) => {
  const { fullName, phone, password, passwordConfirm, email } = req.body;
  console.log("phone number", phone);
  // Phone validation
  if (!phone || !validateUSPhone(phone)) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "account_creation",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      description: `Invalid US phone number: ${phone}`,
    });
    return next(new AppError("Please provide a valid US phone number", 400));
  }

  // Password validation
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

  try {
    // Generate OTP
    const otp = generateOTP();
    // e.g., 6-digit code
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    // Create new user
    const newUser = await User.create({
      fullName,
      email,
      phone: phone.replace(/\D/g, ""), // store only digits
      password,
      passwordConfirm,
      otp: hashedOtp,
      otpExpires,
      phoneVerified: false,
    });

    // Send OTP via SMS
    const phoneNum = `+1${newUser.phone}`;
    console.log(phoneNum);
    try {
      const twilioRespone = await twilioService.sendOTP(phoneNum, otp);
      console.log("twilio", twilioRespone);
      await securityLogService.logEvent({
        user: newUser._id,
        userTypeModel: "User",
        eventType: "otp_sent",
        severity: "info",
        status: "success",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        description: "OTP sent successfully via SMS",
        metadata: {
          phone: newUser.phone,
          method: "sms",
        },
      });
    } catch (smsError) {
      // Log SMS failure but don't block user creation
      await securityLogService.logEvent({
        user: newUser._id,
        userTypeModel: "User",
        eventType: "otp_sent",
        severity: "error",
        status: "failure",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        description: "Failed to send OTP via SMS",
        metadata: {
          phone: newUser.phone,
          error: smsError.message,
        },
      });

      // Continue with user creation but indicate SMS failure
      console.error("SMS sending failed:", smsError);
    }

    await securityLogService.logEvent({
      user: newUser._id,
      userTypeModel: "User",
      eventType: "account_creation",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "New user created, OTP sent to phone",
      metadata: { phone: newUser.phone },
    });

    res.status(201).json({
      status: "success",
      requiresVerification: true,
      message:
        "Account created! Please verify with the OTP sent to your phone.",
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          phone: newUser.phone,
        },
      },
    });
  } catch (err) {
    console.log(err);
    if (err.code === 11000) {
      return next(
        new AppError(
          "This phone number is already registered. Please log in.",
          400
        )
      );
    }
    return next(
      new AppError(
        "There was an error creating your account. Please try again.",
        500
      )
    );
  }
});
exports.sendOtp = catchAsync(async (req, res, next) => {
  const { phone: loginId } = req.body;
  console.log(loginId);

  if (!loginId) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "otp_request",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "OTP request failed: phone not provided",
    });
    return next(new AppError("Please enter your phone number", 400));
  }

  // ✅ validate phone
  if (!validator.isMobilePhone(loginId)) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "otp_request",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Invalid phone number format",
      metadata: { loginId },
    });
    return next(new AppError("Please enter a valid phone number", 400));
  }

  // ✅ find user by phone
  let user = await User.findOne({ phone: loginId });
  if (!user) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "otp_request",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "OTP request for non-existent user",
      metadata: { loginId },
    });
    return next(new AppError("No user found with that phone number", 404));
  }

  // ✅ generate & save OTP
  const otp = user.createOtp();
  await user.save({ validateBeforeSave: false });

  await securityLogService.logEvent({
    user: user._id,
    userTypeModel: "User",
    eventType: "otp_generated",
    severity: "info",
    status: "success",
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    description: "OTP generated and sent successfully",
  });

  // 🚫 Do not expose OTP in response
  res.status(200).json({
    status: "success",
    message: "OTP sent to your phone number!",
    otp,
  });

  // TODO: integrate SMS service (e.g., Twilio, AWS SNS, etc.)
  console.log("Generated OTP (send via SMS):", otp);
});
// exports.sendOtp = catchAsync(async (req, res, next) => {
//   const { phone: loginId } = req.body;

//   console.log(loginId);
//   if (!loginId) {
//     await securityLogService.logEvent({
//       userTypeModel: "System",
//       eventType: "login_attempt",
//       severity: "warning",
//       status: "failure",
//       ipAddress: req.ip,
//       userAgent: req.get("User-Agent"),
//       description: "OTP request failed: loginId not provided",
//     });
//     return next(new AppError("Please enter loginId", 401));
//   }
//   let user;
//   if (!validator.isMobilePhone(loginId)) {
//     await securityLogService.logEvent({
//       userTypeModel: "System",
//       eventType: "login_attempt",
//       severity: "warning",
//       status: "failure",
//       ipAddress: req.ip,
//       userAgent: req.get("User-Agent"),
//       description: "OTP request failed: provide a valid phone number",
//       metadata: { loginId },
//     });
//     return next(new AppError("Please enter a valid phone number", 401));
//   }
//   user = await User.findOne();

//   if (!user) {
//     await securityLogService.logEvent({
//       userTypeModel: "System",
//       eventType: "login_attempt",
//       severity: "warning",
//       status: "failure",
//       ipAddress: req.ip,
//       userAgent: req.get("User-Agent"),
//       description: "OTP request for non-existent user",
//       metadata: { loginId },
//     });
//     return next(
//       new AppError("No user found with that email or phone number", 404)
//     );
//   }

//   const otp = user.createOtp();

//   await user.save({ validateBeforeSave: false });
//   await securityLogService.logEvent({
//     user: user._id,
//     userTypeModel: "User",
//     eventType: "password_reset_request",
//     severity: "info",
//     status: "success",
//     ipAddress: req.ip,
//     userAgent: req.get("User-Agent"),
//     description: "OTP generated and sent",
//   });
//   res.status(200).json({
//     status: "success",
//     message: "OTP sent to your email or phone!",
//     otp,
//   });
// });

exports.verifyOtp = catchAsync(async (req, res, next) => {
  const { phone: loginId, otp } = req.body;

  if (!loginId || !otp) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "otp_verification",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Missing phone or OTP during verification",
    });
    return next(new AppError("Please provide phone and OTP", 400));
  }

  // normalize phone number
  const normalizedPhone = loginId.replace(/\D/g, "");

  // fetch user with OTP fields
  const user = await User.findOne({ phone: normalizedPhone }).select(
    "+otp +otpExpires"
  );
  if (!user) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "otp_verification",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "OTP verification for non-existent user",
      metadata: { phone: normalizedPhone },
    });
    return next(new AppError("No user found with that phone number", 404));
  }
  console.log(user.verifyOtp(otp));
  // 🔑 Verify OTP using schema method
  if (!user.verifyOtp(otp)) {
    await securityLogService.logEvent({
      user: user._id,
      userTypeModel: "User",
      eventType: "otp_verification",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Invalid or expired OTP provided",
    });
    return next(new AppError("OTP is invalid or has expired", 401));
  }

  // OTP is valid → clear it
  user.otp = undefined;
  user.otpExpires = undefined;

  let verificationContext = "login";
  let message = "Logged in successfully";

  if (user.status === "inactive" && !user.phoneVerified) {
    user.status = "active";
    user.phoneVerified = true;
    verificationContext = "signup";
    message = "Phone verified successfully! Your account is now active";

    await securityLogService.logEvent({
      user: user._id,
      userTypeModel: "User",
      eventType: "phone_verification",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Phone number verified and account activated during signup",
      metadata: {
        context: "signup",
        previousStatus: "inactive",
        newStatus: "active",
      },
    });
  } else {
    await securityLogService.logEvent({
      user: user._id,
      userTypeModel: "User",
      eventType: "login_success",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "User logged in successfully with OTP",
      metadata: { context: "login", method: "otp" },
    });
  }

  user.lastActive = new Date();
  user.verificationContext = verificationContext;
  await user.save({ validateBeforeSave: false });

  // Send JWT and log user in
  createSendToken(user, message, 200, res);
});

exports.resendOtp = catchAsync(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new AppError("Phone number is required", 400));
  }

  // Find user by phone
  const user = await User.findOne({ phone });
  if (!user) {
    return next(new AppError("No user found with this phone number", 404));
  }

  // Generate new OTP
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry
  await user.save({ validateBeforeSave: false });

  // Send OTP via SMS (or console log for demo)
  // await sendSms(user.phone, `Your OTP is ${otp}`);

  res.status(200).json({
    status: "success",
    message: "New OTP has been sent to your phone",
    loginId: user._id, // frontend uses this for verifyOtp
    otp,
  });
});

exports.logout = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Clear the jwt cookie
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  const successResponse = {
    status: "success",
    message: "Logged out successfully",
    action: "clearLocalStorage",
  };

  // If no token is provided, we still clear the cookie and respond successfully, but log the attempt.
  if (!token) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "logout_attempt",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Logout attempt without token",
    });
    return res.status(200).json(successResponse);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "logout_attempt",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Logout attempt with invalid token",
    });
    return res.status(200).json(successResponse);
  }

  // Check if the user exists
  const user = await User.findOne({ _id: decoded.id });
  if (!user) {
    await securityLogService.logEvent({
      userTypeModel: "System",
      eventType: "logout_attempt",
      severity: "warning",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Logout attempt for non-existent user",
    });
    return res.status(200).json(successResponse);
  }

  try {
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Add the token to the blacklist
    const black = await TokenBlacklist.create({
      token,
      user: decoded.id,
      userType: "user",
      expiresAt,
      reason: "logout",
    });

    // Log the successful logout
    await securityLogService.logEvent({
      user: decoded.id,
      userTypeModel: "User",
      eventType: "logout",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "User logged out successfully",
    });

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error("Logout processing error:", error);

    // Handle duplicate key error (if the same token is being blacklisted again)
    if (error.code === 11000) {
      return res.status(200).json(successResponse);
    }
    await securityLogService.logEvent({
      user: decoded?.id || null,
      userTypeModel: decoded?.id ? "User" : "System",
      eventType: "logout_error",
      severity: "error",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Logout processing error",
      metadata: { error: error.message },
    });
    // Log the error

    return res.status(200).json({
      ...successResponse,
      message: "Logged out with minor issues",
    });
  }
});
// Protect routes
exports.protect = catchAsync(async (req, res, next) => {
  const fullPath = req.originalUrl.split("?")[0];
  const method = req.method.toUpperCase();

  // 1) Public routes bypass auth
  if (isPublicRoute(fullPath, method)) {
    console.log("🟢 Public route, skipping auth");
    return next();
  }

  // 2) Extract token
  let token = extractToken(req.headers.authorization);
  if (!token && req.cookies?.jwt) {
    token = req.cookies.jwt; // ✅ make sure key matches
  }

  if (!token) {
    console.log("❌ No token found");
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 3) Check blacklist
  const blacklisted = await TokenBlacklist.findOne({ token });
  if (blacklisted) {
    console.log("❌ Token is blacklisted");
    return next(
      new AppError("Your session has expired. Please log in again.", 401)
    );
  }

  // 4) Verify token
  const { decoded, error } = await verifyToken(token);

  if (error || !decoded) {
    console.log("❌ Invalid or expired token");
    return next(new AppError("Invalid or expired token", 401));
  }

  // 5) Find user
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    console.log("❌ No user found for this token");
    return next(
      new AppError("The user belonging to this token no longer exists.", 401)
    );
  }

  // 6) Check password change
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    console.log("❌ Password changed after token was issued");
    return next(
      new AppError("Password recently changed! Please log in again.", 401)
    );
  }

  // 7) Attach user
  req.user = currentUser;

  next();
});

// Role-based restriction
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

exports.forgotPassword = catchAsync(async (req, res, next) => {
  try {
    const { loginId } = req.body;

    if (!loginId) {
      return next(new AppError("Please provide email or phone number", 400));
    }

    // Identify if email or phone
    // const isEmail = loginId.includes("@");
    // const query = isEmail
    //   ? { email: loginId.toLowerCase() }
    //   : { phone: loginId };
    const user = await User.findOne({ email: loginId.toLowerCase() });

    if (!user) {
      // Do not reveal if user exists
      return res.status(200).json({
        message: "If the account exists, a reset link has been sent.",
        method: "email",
      });
    }

    // 1) Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2) Hash and set resetToken in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry
    await user.save({ validateBeforeSave: false });

    // 3) Build reset link
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/reset-Password/${resetToken}`;

    // 4) Send reset link

    // await sendCustomEmail({
    //   email: user.email,
    //   subject: "Password Reset Link",
    //   message: `
    //       <h2>Password Reset Request</h2>
    //       <p>Click the link below to reset your password:</p>
    //       <a href="${resetURL}" target="_blank">${resetURL}</a>
    //       <p>This link will expire in 10 minutes.</p>
    //       <p>If you didn’t request this, ignore this email.</p>
    //     `,
    // });

    // Log security event
    await securityLogService.logEvent({
      user: user._id,
      userTypeModel: "User",
      eventType: "password_reset_request",
      severity: "info",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password reset token sent",
    });

    res.status(200).json({
      status: "success",
      message: "If the account exists, a reset link has been sent.",
      method: "email",
      url: resetURL,
    });
  } catch (error) {
    console.error("Password reset initiation error:", error);
    next(
      new AppError("Failed to initiate password reset. Please try again.", 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { password, passwordConfirm, userId } = req.body;
  console.log(password, passwordConfirm);

  // 1. Validate input
  if (!password || !passwordConfirm) {
    return next(
      new AppError("Please provide both password and confirmation", 400)
    );
  }

  if (password !== passwordConfirm) {
    return next(new AppError("Passwords do not match", 400));
  }

  // 2. Get the user (ID should come from previous verified OTP/token step)

  // You need to attach `req.user` or `req.userId` in OTP verification/token middleware
  const user = await User.findById(userId).select("+password");

  if (!user) {
    await securityLogService.logEvent({
      user: userId,
      userTypeModel: "User",
      eventType: "password_reset",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password reset failed",
    });
    return next(new AppError("User not found", 404));
  }

  // 3. Set new password
  user.password = password;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpType = undefined;

  await user.save(); // runs password hashing in pre-save hook

  // 4. (Optional) Log the event
  await securityLogService.logEvent({
    user: user._id,
    userTypeModel: "User",
    eventType: "password_reset",
    severity: "info",
    status: "success",
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    description: "Password reset successfully",
  });

  // 5. Send success response (and maybe auto-login)
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  // 1. Validate input
  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    await securityLogService.logEvent({
      user: req.user.id,
      userTypeModel: "User",
      eventType: "password_update",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password update failed",
    });
    return next(
      new AppError("Please provide both current password and new password", 400)
    );
  }

  if (newPassword !== newPasswordConfirm) {
    await securityLogService.logEvent({
      user: req.user.id,
      userTypeModel: "User",
      eventType: "password_update",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password update failed",
    });
    return next(new AppError("Passwords do not match", 400));
  }

  // 2. Get the user
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    await securityLogService.logEvent({
      user: req.user.id,
      userTypeModel: "User",
      eventType: "password_update",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password update failed",
    });
    return next(new AppError("User not found", 404));
  }

  // 3. Check if current password is correct
  if (!(await user.correctPassword(currentPassword, user.password))) {
    await securityLogService.logEvent({
      user: req.user.id,
      userTypeModel: "User",
      eventType: "password_update",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Password update failed",
    });
    return next(new AppError("Current password is incorrect", 401));
  }

  // 4. Set new password
  user.password = newPassword;
  await user.save(); // runs password hashing in pre-save hook

  // 5. (Optional) Log the event
  await securityLogService.logEvent({
    user: user._id,
    userTypeModel: "User",
    eventType: "password_update",
    severity: "info",
    status: "success",
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    description: "Password updated successfully",
  });

  // 6. Send success response (and maybe auto-login)
  createSendToken(user, 200, res);
});
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -__v");

  if (!user) {
    await securityLogService.logEvent({
      user: req.user.id,
      userTypeModel: "User",
      eventType: "get_me",
      severity: "error",
      status: "failed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      description: "Get me failed",
    });
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { user },
  });
});
