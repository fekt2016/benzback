// utils/jwtHelper.js
const jwt = require("jsonwebtoken");

exports.extractToken = (req) => {
  let token = null;

  // 1) From Cookie
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // 2) From Authorization header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  return token;
};

exports.verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { decoded };
  } catch (error) {
    return { error };
  }
};
