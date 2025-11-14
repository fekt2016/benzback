const jwt = require("jsonwebtoken");

const signToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  if (!process.env.JWT_EXPIRES_IN) {
    throw new Error("JWT_EXPIRES_IN is not defined in environment variables");
  }

  return jwt.sign({ id: id, role: role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.createSendToken = (user, message, statusCode, res) => {
  const token = signToken(user._id, user.role);

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,                // HTTPS only in production
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(
      Date.now() +
        (parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 90) *
          24 *
          60 *
          60 *
          1000
    )
    // ❗ DO NOT set domain, browser rejects it if it doesn't match exactly
  };

  res.cookie("jwt", token, cookieOptions);

  // Hide password
  user.password = undefined;

  return res.status(statusCode).json({
    status: "success",
    message,
    token,
    data: { user },
  });
};
