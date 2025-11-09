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
  
  // Safari requires Secure=true when SameSite=None
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // Must be true in production for Safari
    sameSite: isProduction ? "none" : "lax", // "none" requires Secure=true
    expires: new Date(
      Date.now() +
        (parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 90) * 24 * 60 * 60 * 1000
    ),
    domain: isProduction ? ".benzflex.com" : undefined, // Allow subdomain cookies in production
  };

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;
  const data = {
    status: "success",
    message,
    token,
    data: {
      user,
    },
  };

  res.status(statusCode).json(data);
};
