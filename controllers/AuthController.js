const { validateUSPhone } = require("../utils/helper");
const catchAsync = require("../utils/catchAysnc");
const { generateOTP } = require("../utils/OtpSystem");
const crypto = require("crypto");
const User = require("../models/userModel");

exports.signup = catchAsync(async (req, res, next) => {
  //get form fields from the body
  const { fullName, phone, password, passwordConfirm, email } = req.body;
  console.log(fullName, phone, password, passwordConfirm, email);

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
  res.status(200).json({
    status: "success",
    message: "Account created! Please verify with the OTP sent to your phone",
    data: {
      user: {
        id: newUser._id,
        name: newUser.fullName,
        phone: newUser.phone,
      },
    },
  });
});
exports.login = (req, res) => {};
