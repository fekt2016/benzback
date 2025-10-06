const mongoose = require("mongoose");
const driverSubSchema = new mongoose.Schema(
  {
    name: { type: String }, // driver's name
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDefault: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },

    license: {
      number: { type: String },
      issuedBy: { type: String },
      expiryDate: { type: Date },
      fileUrl: { type: String, required: true }, // Cloudinary link
      verified: { type: Boolean, default: false },
    },

    insurance: {
      provider: { type: String },
      policyNumber: { type: String },
      expiryDate: { type: Date },
      fileUrl: { type: String, required: true }, // Cloudinary link
      verified: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

driverSubSchema.pre("save", function (next) {
  if (this.license?.verified && this.insurance?.verified) {
    this.verified = true;
  } else {
    this.verified = false; // fallback if one gets unverified later
  }
  next();
});
driverSubSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  // Check nested updates inside $set
  const licenseVerified =
    update["license.verified"] ?? update.$set?.["license.verified"];
  const insuranceVerified =
    update["insurance.verified"] ?? update.$set?.["insurance.verified"];

  // If both explicitly true, set verified = true
  if (licenseVerified === true && insuranceVerified === true) {
    this.set({ verified: true });
  }

  // If one explicitly false, set verified = false
  if (licenseVerified === false || insuranceVerified === false) {
    this.set({ verified: false });
  }

  next();
});
module.exports = mongoose.model("Driver", driverSubSchema);
