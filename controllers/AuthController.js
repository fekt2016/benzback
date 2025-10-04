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
// const { sendOTP } = require("../services/twilio");

exports.signup = catchAsync(async (req, res, next) => {
  //get form fields from the body
  const { fullName, phone, password, passwordConfirm, email } = req.body;
  //   console.log(fullName, phone, password, passwordConfirm, email);

  if (!phone || !validateUSPhone(phone)) {
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
    $or: [{ email }, { phone: phone.replace(/\D/g, "") }],
  });

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
    phone: phone.replace(/\D/g, ""),
    password,
    passwordConfirm,
    otp: hashedOtp,
    otpExpires,
    phoneVerified: false,
  });

  //   try {
  //     await sendOTP(phone, otp);
  //   } catch (err) {
  //     console.log(err);
  //     return next(
  //       new AppError("Account created but failed to send OTP SMS", 500)
  //     );
  //   }
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
  const { phone } = req.body;
  if (!phone) {
    return next(new AppError("Please enter your phone number", 400));
  }
  if (!validator.isMobilePhone(phone)) {
    return next(new AppError("Please enter a valid phone number", 400));
  }
  let user = await User.findOne({ phone: phone });
  const otp = user.createOtp();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "OTP sent to your phone number!",
    email: user.email,
    name: user.name,
    otp: otp,
  });
});
exports.resendOtp = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  console.log("phone", phone);

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
  user.otpExpires = Date.now() + 3 * 60 * 1000; // 10 min expiry
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
// exports.protect = catchAsync(async (req, res, next) => {
//   let token;
//   console.log(req.cookies);

//   // 1) Check if token is in the headers
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(
//       new AppError("You are not logged in! Please log in to get access.", 401)
//     );
//   }

//   // 2) Verify token
//   const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

//   // 3) Check if user still exists
//   const currentUser = await User.findById(decoded.id);
//   if (!currentUser) {
//     return next(
//       new AppError("The user belonging to this token no longer exists.", 401)
//     );
//   }

//   req.user = currentUser;
//   next();
// });

// exports.protect = catchAsync(async (req, res, next) => {
//   const fullPath = req.originalUrl.split("?")[0];
//   const method = req.method.toUpperCase();

//   if (isPublicRoute(fullPath, method)) {
//     console.log("🟢 Public route, skipping auth");
//     return next();
//   }
//   let token = extractToken(req.headers.authorization);
//   if (!token && req.cookies?.jwt) {
//     token = req.cookies.jwt; // ✅ make sure key matches
//   }

//   if (!token) {
//     console.log("❌ No token found");
//     return next(
//       new AppError("You are not logged in! Please log in to get access.", 401)
//     );
//   }
//   // const blacklisted = await TokenBlacklist.findOne({ token });
//   // if (blacklisted) {
//   //   console.log("❌ Token is blacklisted");
//   //   return next(
//   //     new AppError("Your session has expired. Please log in again.", 401)
//   //   );
//   // }
//   const { decoded, error } = await verifyToken(token);
//   const currentUser = await User.findById(decoded.id);

//   if (!currentUser) {
//     console.log("❌ No user found for this token");
//     return next(
//       new AppError("The user belonging to this token no longer exists.", 401)
//     );
//   }

//   if (currentUser.changedPasswordAfter(decoded.iat)) {
//     console.log("❌ Password changed after token was issued");
//     return next(
//       new AppError("Password recently changed! Please log in again.", 401)
//     );
//   }
//   console.log(currentUser);
//   req.user = currentUser;
//   next();
// });
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
