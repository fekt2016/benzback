exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
};

exports.verifyOTP = (user, otp) => {
  return user.otp === otp;
};

exports.resetOTP = (user) => {
  user.otp = exports.generateOTP();
  user.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  return user.save();
};

exports.isOTPExpired = (user) => {
  return Date.now() > user.otpExpiresAt;
};

exports.clearOTP = (user) => {
  user.otp = null;
  user.otpExpiresAt = null;
  return user.save();
};
