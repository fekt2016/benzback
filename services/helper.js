
exports.generatePasswordResetData = (req, user, resetToken) => {
  const isProduction = process.env.NODE_ENV === "production";

  const baseURL = isProduction
    ? process.env.FRONTEND_URL || "https://benzflex.com"
    : "http://localhost:5173";

  const resetURL = `${baseURL}/reset-password/${resetToken}`;

  return {
    email: user.email,
    name: user.fullName || "Customer",
    resetURL,
    expiryTime: "1 hour",
  };
};