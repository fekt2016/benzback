// const twilio = require("twilio");

// // Initialize Twilio client with validation
// function initializeTwilioClient() {
//   const accountSid = process.env.TWILIO_ACCOUNT_SID;
//   const authToken = process.env.TWILIO_AUTH_TOKEN;
//   const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

//   // Validate required environment variables
//   if (!accountSid || !authToken) {
//     throw new Error(
//       "Twilio credentials are missing. Please check your environment variables."
//     );
//   }

//   if (!messagingServiceSid) {
//     console.warn(
//       "⚠️  TWILIO_MESSAGING_SERVICE_SID not set. Using phone number fallback."
//     );
//   }

//   return twilio(accountSid, authToken);
// }

// const client = initializeTwilioClient();

// // Constants
// const SMS_TYPES = {
//   OTP: "OTP",
//   WELCOME: "WELCOME",
//   TRANSACTIONAL: "TRANSACTIONAL",
// };

// const ERROR_MESSAGES = {
//   INVALID_PHONE: "Invalid phone number format",
//   TWILIO_ERROR: "Message service temporarily unavailable",
//   RATE_LIMITED: "Too many attempts, please try again later",
// };

// /**
//  * Validates and formats phone number to E.164 format
//  * @param {string} phone - The phone number to format
//  * @returns {string} Formatted phone number in E.164 format
//  * @throws {Error} If phone number is invalid
//  */
// function formatPhoneNumber(phone) {
//   if (!phone || typeof phone !== "string") {
//     throw new Error(ERROR_MESSAGES.INVALID_PHONE);
//   }

//   // Remove all non-digit characters except leading +
//   const digits = phone.replace(/[^\d+]/g, "");

//   // Handle US/Canada numbers (add +1 if missing)
//   if (digits.length === 10 && !digits.startsWith("+")) {
//     return `+1${digits}`;
//   }

//   // Handle 11-digit US numbers without country code
//   if (
//     digits.length === 11 &&
//     digits.startsWith("1") &&
//     !digits.startsWith("+")
//   ) {
//     return `+${digits}`;
//   }

//   // Ensure international format
//   if (!digits.startsWith("+")) {
//     return `+${digits}`;
//   }

//   return digits;
// }

// /**
//  * Validates phone number format
//  * @param {string} phone - Phone number to validate
//  * @returns {boolean} True if valid
//  */
// function isValidPhoneNumber(phone) {
//   try {
//     const formatted = formatPhoneNumber(phone);
//     // Basic E.164 validation: + followed by 1-15 digits
//     return /^\+\d{1,15}$/.test(formatted);
//   } catch {
//     return false;
//   }
// }

// /**
//  * Sends SMS using Twilio
//  * @param {Object} options - SMS options
//  * @param {string} options.to - Recipient phone number
//  * @param {string} options.body - Message body
//  * @param {string} options.type - SMS type for logging
//  * @returns {Promise<Object>} Send result
//  */
// async function sendSMS({ to, body, type = SMS_TYPES.TRANSACTIONAL }) {
//   try {
//     // Validate phone number
//     if (!isValidPhoneNumber(to)) {
//       throw new Error(ERROR_MESSAGES.INVALID_PHONE);
//     }

//     const formattedTo = formatPhoneNumber(to);
//     const messageOptions = {
//       body: body,
//       to: formattedTo,
//     };

//     // Prefer Messaging Service SID over phone number
//     if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
//       messageOptions.messagingServiceSid =
//         process.env.TWILIO_MESSAGING_SERVICE_SID;
//     } else if (process.env.TWILIO_PHONE_NUMBER) {
//       messageOptions.from = process.env.TWILIO_PHONE_NUMBER;
//     } else {
//       throw new Error("No messaging service or phone number configured");
//     }

//     const message = await client.messages.create(messageOptions);

//     console.log(`✅ ${type} SMS sent to ${formattedTo}: ${message.sid}`);

//     return {
//       success: true,
//       messageId: message.sid,
//       status: message.status,
//       to: formattedTo,
//     };
//   } catch (error) {
//     console.error(`❌ Failed to send ${type} SMS to ${to}:`, error.message);

//     // Handle specific Twilio error codes
//     if (error.code === 21408) {
//       // Invalid phone number
//       throw new Error(ERROR_MESSAGES.INVALID_PHONE);
//     } else if (error.code === 21610) {
//       // Blocked phone number
//       throw new Error("This phone number cannot receive messages");
//     } else if (error.code === 20429) {
//       // Rate limited
//       throw new Error(ERROR_MESSAGES.RATE_LIMITED);
//     }

//     throw new Error(error.message || ERROR_MESSAGES.TWILIO_ERROR);
//   }
// }

// /**
//  * Sends OTP code to user
//  * @param {string} phoneNumber - Recipient phone number
//  * @param {string} otp - OTP code to send
//  * @returns {Promise<Object>} Send result
//  */
// async function sendOTP(phoneNumber, otp) {
//   const body = `Your BenzFlex verification code is: ${otp}. This code will expire in 3 minutes.`;

//   return await sendSMS({
//     to: phoneNumber,
//     body: body,
//     type: SMS_TYPES.OTP,
//   });
// }

// /**
//  * Sends welcome message to new user
//  * @param {string} phoneNumber - Recipient phone number
//  * @param {string} userName - User's name
//  * @returns {Promise<Object>} Send result
//  */
// async function sendWelcomeSMS(phoneNumber, userName) {
//   const body = `Welcome to BenzFlex, ${userName}! 🚗 Your premium car rental experience starts now. Download our app: [App Store Link] | [Google Play Link]`;

//   try {
//     return await sendSMS({
//       to: phoneNumber,
//       body: body,
//       type: SMS_TYPES.WELCOME,
//     });
//   } catch (error) {
//     // Welcome SMS is non-critical, log but don't throw
//     console.warn("⚠️ Welcome SMS failed (non-critical):", error.message);
//     return {
//       success: false,
//       error: error.message,
//       nonCritical: true,
//     };
//   }
// }

// /**
//  * Sends transactional SMS (booking confirmations, reminders, etc.)
//  * @param {string} phoneNumber - Recipient phone number
//  * @param {string} message - Transactional message
//  * @returns {Promise<Object>} Send result
//  */
// async function sendTransactionalSMS(phoneNumber, message) {
//   return await sendSMS({
//     to: phoneNumber,
//     body: message,
//     type: SMS_TYPES.TRANSACTIONAL,
//   });
// }

// module.exports = {
//   sendOTP,
//   sendWelcomeSMS,
//   sendTransactionalSMS,
//   isValidPhoneNumber,
//   formatPhoneNumber,
//   SMS_TYPES,
//   ERROR_MESSAGES,
// };
