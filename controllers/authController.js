const catchAsync = require("../utils/catchAsync");
const { validateUSPhone } = require("../utils/helper");
const { generateOTP } = require("../utils/otpService");
const AppError = require("../utils/appError");
const crypto = require("crypto");
const User = require("../models/userModel");
const securityLogService = require("../utils/securityLogService");
const twilioService = require("../service/twilio");

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
