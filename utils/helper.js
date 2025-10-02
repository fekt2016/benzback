const validateUSPhone = (phone) => {
  if (!phone) return true; // optional

  // Remove all non-digit characters
  const cleanedPhone = phone.replace(/\D/g, "");

  // US formats:
  // 1. 10-digit number (no country code)
  // 2. 11-digit starting with "1" (US country code)
  const usRegex = /^(\d{10}|1\d{10})$/;

  return usRegex.test(cleanedPhone);
};

module.exports = { validateUSPhone };
