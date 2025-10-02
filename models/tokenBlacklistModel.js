// models/tokenBlacklistModel.js
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    userType: {
      type: String,
      enum: ["admin", "user"], // ✅ only roles you support
      default: "user",
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      index: { expires: 0 }, // TTL index to auto-delete expired tokens
    },
    reason: {
      type: String,
      enum: ["logout", "security", "password_reset", "system"],
      default: "logout",
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Compound index for faster lookups
tokenBlacklistSchema.index({ token: 1, user: 1 });

// ✅ Virtual property: check if token is expired
tokenBlacklistSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date();
});

// ✅ Normalize token before saving
tokenBlacklistSchema.pre("save", function (next) {
  this.token = this.token.trim();
  next();
});

// ✅ Check if a token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function (token) {
  const decoded = jwt.decode(token);

  // If already expired, treat as blacklisted (no need to query DB)
  if (decoded && decoded.exp * 1000 < Date.now()) return true;

  return this.exists({ token });
};

// ✅ Bulk blacklist multiple tokens at once
tokenBlacklistSchema.statics.blacklistTokens = async function (tokens) {
  const tokensWithExpiry = tokens.map((token) => {
    const decoded = jwt.decode(token);
    return {
      token,
      user: decoded?.id || null,
      userType: decoded?.role || "user",
      expiresAt: new Date(decoded.exp * 1000),
      reason: "system",
    };
  });

  return this.insertMany(tokensWithExpiry, { ordered: false });
};

// ✅ Invalidate ALL sessions for a specific user
tokenBlacklistSchema.statics.invalidateAllSessions = async function (userId) {
  const globalToken = `global_invalidation:${userId}`;

  // Set to expire far in the future (10 years)
  const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);

  await this.findOneAndUpdate(
    { token: globalToken },
    {
      token: globalToken,
      user: userId,
      expiresAt,
      reason: "security",
      userType: "user",
    },
    { upsert: true, new: true }
  );
};

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
module.exports = TokenBlacklist;
