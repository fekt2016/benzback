const catchAsync = require("../utils/catchAsync");
const { validateUSPhone } = require("../utils/helper");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
// const securityLogService = require("../utils/securityLogService");
// const twilioService = require("../service/twilio");

exports.signup = catchAsync(async (req, res, next) => {
  const { fullName, phone, password, passwordConfirm, email } = req.body;

  // Phone validation
  if (!phone || !validateUSPhone(phone)) {
    // await securityLogService.logEvent({
    //   userTypeModel: "System",
    //   eventType: "account_creation",
    //   severity: "warning",
    //   status: "failure",
    //   ipAddress: req.ip || req.connection.remoteAddress,
    //   userAgent: req.get("User-Agent"),
    //   description: `Invalid US phone number: ${phone}`,
    // });
    return next(new AppError("Please provide a valid US phone number", 400));
  }

  // Create new user
  const newUser = new User({
    fullName,
    email,
    phone: phone.replace(/\D/g, ""),
    password,
    passwordConfirm, // validated by schema, never stored
    phoneVerified: false,
  });

  // Generate OTP
  const otp = newUser.createOtp();

  await newUser.save({ validateBeforeSave: true });

  // Send OTP via SMS
  const phoneNum = `+1${newUser.phone}`;
  try {
    // await twilioService.sendOTP(phoneNum, otp);
    // await securityLogService.logEvent({
    //   user: newUser._id,
    //   userTypeModel: "User",
    //   eventType: "otp_sent",
    //   severity: "info",
    //   status: "success",
    //   ipAddress: req.ip,
    //   userAgent: req.get("User-Agent"),
    //   description: "OTP sent successfully via SMS",
    //   metadata: {
    //     phone: newUser.phone,
    //     method: "sms",
    //   },
    // });
  } catch (smsError) {
    // await securityLogService.logEvent({
    //   user: newUser._id,
    //   userTypeModel: "User",
    //   eventType: "otp_sent",
    //   severity: "error",
    //   status: "failure",
    //   ipAddress: req.ip,
    //   userAgent: req.get("User-Agent"),
    //   description: "Failed to send OTP via SMS",
    //   metadata: {
    //     phone: newUser.phone,
    //     error: smsError.message,
    //   },
    // });

    console.error("SMS sending failed:", smsError);
  }

  //   await securityLogService.logEvent({
  //     user: newUser._id,
  //     userTypeModel: "User",
  //     eventType: "account_creation",
  //     severity: "info",
  //     status: "success",
  //     ipAddress: req.ip,
  //     userAgent: req.get("User-Agent"),
  //     description: "New user created, OTP sent to phone",
  //     metadata: { phone: newUser.phone },
  //   });

  res.status(201).json({
    status: "success",
    requiresVerification: true,
    message: "Account created! Please verify with the OTP sent to your phone.",
    data: {
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
      },
    },
  });
});
