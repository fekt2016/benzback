const { validateUSPhone } = require("../utils/helper");
const catchAsync = require("../utils/catchAysnc");
const { generateOTP } = require("../utils/OtpSystem");

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
  res
    .status(200)
    .json({ status: "success", message: "Validation passed", otp, otpExpires });
});
exports.login = (req, res) => {};
