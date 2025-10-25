const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../models/TokenBlacklistModel");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.token = token;
    
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = auth;