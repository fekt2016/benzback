// // utils/twilioService.js
// const twilio = require("twilio");

// class TwilioService {
//   constructor() {
//     this.client = twilio(
//       process.env.TWILIO_ACCOUNT_SID,
//       process.env.TWILIO_AUTH_TOKEN
//     );
//   }

//   async sendOTP(phoneNumber, otp) {
//     console.log("twilio service", phoneNumber);
//     try {
//       const message = await this.client.messages.create({
//         body: `Your BenzFlex verification code is: ${otp}. This code will expire in 30sec`,
//         from: process.env.TWILIO_PHONE_NUMBER,
//         to: this.formatPhoneNumber(phoneNumber),
//       });

//       console.log(`OTP sent to ${phoneNumber}: ${message.sid}`);
//       return { success: true, messageId: message.sid };
//     } catch (error) {
//       console.error("Twilio SMS error:", error);
//       throw new Error(`Failed to send SMS: ${error.message}`);
//     }
//   }

//   formatPhoneNumber(phone) {
//     // Remove all non-digit characters
//     const digits = phone.replace(/\D/g, "");

//     // If it's 10 digits, assume US number and add +1
//     if (digits.length === 10) {
//       return `+1${digits}`;
//     }

//     // If it's 11 digits and starts with 1, add +
//     if (digits.length === 11 && digits.startsWith("1")) {
//       return `+${digits}`;
//     }

//     // Otherwise, assume it's already in E.164 format or return as is
//     return digits.startsWith("+") ? digits : `+${digits}`;
//   }

//   async sendWelcomeSMS(phoneNumber, userName) {
//     try {
//       const message = await this.client.messages.create({
//         body: `Welcome to BenzFlex, ${userName}! 🚗 Your premium car rental experience starts now. Download our app: [App Store Link]`,
//         from: process.env.TWILIO_PHONE_NUMBER,
//         to: this.formatPhoneNumber(phoneNumber),
//       });

//       return { success: true, messageId: message.sid };
//     } catch (error) {
//       console.error("Welcome SMS error:", error);
//       // Don't throw error for welcome SMS as it's not critical
//       return { success: false, error: error.message };
//     }
//   }
// }

// module.exports = new TwilioService();
