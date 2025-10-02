const twilio = require("twilio");

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendOTP = async (phone, otp) => {
  await client.messages.create({
    body: `Your BenzFlex verification code is: ${otp}`,
    from: process.env.TWILIO_PHONE_NUMBER, // Twilio number
    to: `+1${phone.replace(/\D/g, "")}`, // enforce +1
  });
};
