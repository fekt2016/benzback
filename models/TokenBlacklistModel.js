// models/TokenBlacklist.js
const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    // The JWT token to be blacklisted
    token: {
      type: String,
      required: true,
      index: true,
    },
    
    // User associated with the token (optional but recommended)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Token expiration time (from JWT payload)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Type of token (access, refresh, etc.)
    tokenType: {
      type: String,
      enum: ["access", "refresh", "password_reset", "email_verification","used_for_reset"],
      default: "access",
      index: true,
    },
    
    // Reason for blacklisting
    reason: {
      type: String,
      enum: [
        "logout",
        "password_change", 
        "suspicious_activity",
        "admin_revoked",
        "token_refresh",
        "system_cleanup",
        "used_for_reset"
      ],
      default: "logout",
    },
    
    // Additional metadata
    ipAddress: {
      type: String,
      default: null,
    },
    
    userAgent: {
      type: String,
      default: null,
    },
    
    // For tracking and audit purposes
    blacklistedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    // If this blacklist entry was created by an admin
    blacklistedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    
    // Optional: Reference to the new token if this was replaced during refresh
    replacedByToken: {
      type: String,
      default: null,
    }
  },
  {
    timestamps: true,
    // Auto-delete expired tokens using MongoDB TTL
    expireAfterSeconds: 0, // Documents expire at the 'expiresAt' time
  }
);

// Compound indexes for better query performance
// tokenBlacklistSchema.index({ token: 1, user: 1 });
// tokenBlacklistSchema.index({ user: 1, tokenType: 1 });
// tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to check if token is blacklisted
tokenBlacklistSchema.statics.isTokenBlacklisted = async function(token) {
  const blacklistedToken = await this.findOne({ 
    token: token,
    expiresAt: { $gt: new Date() } // Only consider not-yet-expired tokens
  });
  
  return !!blacklistedToken;
};

// Static method to blacklist a token
tokenBlacklistSchema.statics.blacklistToken = async function(tokenData) {
  const {
    token,
    user,
    expiresAt,
    tokenType = "access",
    reason = "logout",
    ipAddress = null,
    userAgent = null,
    blacklistedBy = null,
    replacedByToken = null
  } = tokenData;

  // Check if token is already blacklisted
  const existing = await this.findOne({ token });
  if (existing) {
    return existing;
  }

  return await this.create({
    token,
    user,
    expiresAt,
    tokenType,
    reason,
    ipAddress,
    userAgent,
    blacklistedBy,
    replacedByToken
  });
};

// Static method to blacklist all user tokens (for password reset, etc.)
tokenBlacklistSchema.statics.blacklistAllUserTokens = async function(
  userId, 
  reason = "password_change",
  blacklistedBy = null
) {
  // In a real implementation, you might want to blacklist all tokens
  // by inserting multiple records or using a different strategy
  
  // For now, we'll return the count of affected tokens
  // Note: This is a simplified implementation
  const result = await this.updateMany(
    { 
      user: userId,
      tokenType: { $in: ["access", "refresh"] }
    },
    { 
      $set: { 
        reason,
        blacklistedBy,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Extend expiration
      } 
    }
  );
  
  return result.modifiedCount;
};

// Static method to cleanup expired tokens (safety net)
tokenBlacklistSchema.statics.cleanupExpiredTokens = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount;
};

// Static method to get user's blacklisted tokens
tokenBlacklistSchema.statics.getUserBlacklistedTokens = async function(userId, options = {}) {
  const {
    tokenType = null,
    limit = 50,
    page = 1
  } = options;
  
  const query = { user: userId };
  if (tokenType) {
    query.tokenType = tokenType;
  }
  
  const tokens = await this.find(query)
    .sort({ blacklistedAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .populate('blacklistedBy', 'name email');
    
  const total = await this.countDocuments(query);
  
  return {
    tokens,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Instance method to check if token is still valid (not expired)
tokenBlacklistSchema.methods.isValid = function() {
  return this.expiresAt > new Date();
};

// Pre-save middleware to validate data
tokenBlacklistSchema.pre('save', function(next) {
  // Ensure expiresAt is in the future
  if (this.expiresAt <= new Date()) {
    const error = new Error('Token expiration must be in the future');
    return next(error);
  }
  
  // Truncate userAgent if too long
  if (this.userAgent && this.userAgent.length > 500) {
    this.userAgent = this.userAgent.substring(0, 500);
  }
  
  next();
});

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);