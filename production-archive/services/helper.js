const { getFrontendUrl } = require("../utils/helper");

exports.generatePasswordResetData = (req, user, resetToken) => {
  const baseURL = getFrontendUrl();
  const resetURL = `${baseURL}/reset-password/${resetToken}`;

  return {
    email: user.email,
    name: user.fullName || "Customer",
    resetURL,
    expiryTime: "1 hour",
  };
};

// Re-export getFrontendUrl for backward compatibility
exports.getFrontendUrl = getFrontendUrl;