const axios = require("axios");
exports.arkeselOtp = async () => {
  const data = {
    expiry: 5,
    length: 6,
    medium: "sms",
    message: "This is OTP from benzflex.com, %otp_code%",
    number: "+16142604004",
    sender_id: "benzflex",
    type: "numeric",
  };
  const headers = {
    "api-key": "a1Z1SGhrR3BQbUZCemx1bnN0bXQ",
  };
  axios
    .post("https://sms.arkesel.com/api/otp/generate", data, { headers })
    .then((response) => console.log(response))
    .catch((error) => console.log(error));
};
