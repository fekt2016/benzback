const jwt = require("jsonwebtoken");

exports.extractToken = (authHeader) => {
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

// Verify JWT
exports.verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { decoded };
  } catch (error) {
    return { error };
  }
};
