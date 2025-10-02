const validateUSPhone = (phone) => {
  if (!phone) return false; // must provide a phone number

  // Remove all non-digit characters
  const cleanedPhone = phone.replace(/\D/g, "");

  // US formats:
  // 10 digits (e.g., 4155551234)
  // 11 digits starting with 1 (e.g., 14155551234)
  const usRegex = /^(1\d{10}|\d{10})$/;

  return usRegex.test(cleanedPhone);
};
const normalizeUSPhone = (phone) => {
  if (!validateUSPhone(phone)) return null;

  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = "1" + cleaned; // add country code
  return `+${cleaned}`;
};
module.exports = { validateUSPhone, normalizeUSPhone };
