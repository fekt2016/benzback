// services/tokenBlacklistService.js
const TokenBlacklist = require('../models/TokenBlacklistModel');
const crypto = require('crypto');

/**
 * Add a token to the blacklist
 */
const addToTokenBlacklist = async (token, userId, reason = 'manual_revocation') => {
  console.log(token, userId, reason)
  try {
    // Hash the token for secure storage
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const blacklistedToken = await TokenBlacklist.create({
      token:tokenHash,
      user:userId,
      reason,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    console.log(`Token blacklisted: ${tokenHash.substring(0, 16)}... for user ${userId}, reason: ${reason}`);
    return blacklistedToken;
  } catch (error) {
    // Handle unique constraint violation (token already blacklisted)
    if (error.code === 11000) {
      console.log(`Token already blacklisted: ${token.substring(0, 16)}...`);
      return await TokenBlacklist.findOne({ 
        tokenHash: crypto.createHash('sha256').update(token).digest('hex') 
      });
    }
    console.error('Failed to blacklist token:', error);
    throw error;
  }
};

/**
 * Check if a token is blacklisted
 */
const isTokenBlacklisted = async (token) => {
  try {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const blacklisted = await TokenBlacklist.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() } // Not expired
    });

    return !!blacklisted;
  } catch (error) {
    console.error('Failed to check token blacklist:', error);
    // In case of error, assume token is blacklisted for safety
    return true;
  }
};

/**
 * Blacklist all previous reset tokens for a user
 */
const blacklistPreviousUserTokens = async (userId) => {
  try {
    // Find user's current valid reset token
    const User = require('../models/User');
    const user = await User.findById(userId).select('+passwordResetToken +passwordResetExpires');
    
    if (user && user.passwordResetToken && user.passwordResetExpires > Date.now()) {
      // Blacklist the previous token
      await addToTokenBlacklist(
        user.passwordResetToken, 
        userId, 
        'superseded_by_new_token'
      );
      
      console.log(`Previous reset token blacklisted for user: ${userId}`);
    }
  } catch (error) {
    console.error('Failed to blacklist previous user tokens:', error);
  }
};

/**
 * Clean up expired blacklisted tokens (can be run as cron job)
 */
const cleanupExpiredTokens = async () => {
  try {
    const result = await TokenBlacklist.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    console.log(`Cleaned up ${result.deletedCount} expired blacklisted tokens`);
    return result;
  } catch (error) {
    console.error('Failed to cleanup expired blacklisted tokens:', error);
    throw error;
  }
};

/**
 * Revoke a specific token (manual revocation)
 */
const revokeToken = async (token, userId, reason = 'manual_revocation') => {
  return await addToTokenBlacklist(token, userId, reason);
};

/**
 * Get blacklist statistics
 */
const getBlacklistStats = async () => {
  try {
    const stats = await TokenBlacklist.aggregate([
      {
        $match: {
          expiresAt: { $gt: new Date() }
        }
      },
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      }
    ]);

    return stats;
  } catch (error) {
    console.error('Failed to get blacklist stats:', error);
    return [];
  }
};

/**
 * Check if token hash is blacklisted (for already hashed tokens)
 */
const isTokenHashBlacklisted = async (tokenHash) => {
  try {
    const blacklisted = await TokenBlacklist.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() }
    });

    return !!blacklisted;
  } catch (error) {
    console.error('Failed to check token hash blacklist:', error);
    return true;
  }
};

/**
 * Bulk blacklist tokens (for migration or batch operations)
 */
const bulkBlacklistTokens = async (tokens) => {
  try {
    const blacklistEntries = tokens.map(({ token, userId, reason = 'bulk_operation' }) => ({
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      userId,
      reason,
      blacklistedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }));

    const result = await TokenBlacklist.insertMany(blacklistEntries, { ordered: false });
    console.log(`Bulk blacklisted ${result.length} tokens`);
    return result;
  } catch (error) {
    // Handle partial failures in bulk operations
    if (error.writeErrors) {
      console.log(`Bulk blacklist partially succeeded. ${error.writeErrors.length} errors`);
    }
    console.error('Failed to bulk blacklist tokens:', error);
    throw error;
  }
};

/**
 * Remove token from blacklist (for admin purposes)
 */
const removeFromBlacklist = async (tokenHash) => {
  try {
    const result = await TokenBlacklist.deleteOne({ tokenHash });
    if (result.deletedCount > 0) {
      console.log(`Token removed from blacklist: ${tokenHash.substring(0, 16)}...`);
    }
    return result;
  } catch (error) {
    console.error('Failed to remove token from blacklist:', error);
    throw error;
  }
};

/**
 * Get all blacklisted tokens for a user
 */
const getUserBlacklistedTokens = async (userId) => {
  try {
    const tokens = await TokenBlacklist.find({ 
      userId,
      expiresAt: { $gt: new Date() }
    }).sort({ blacklistedAt: -1 });

    return tokens;
  } catch (error) {
    console.error('Failed to get user blacklisted tokens:', error);
    return [];
  }
};

/**
 * Check multiple tokens at once
 */
const checkMultipleTokens = async (tokens) => {
  try {
    const tokenHashes = tokens.map(token => 
      crypto.createHash('sha256').update(token).digest('hex')
    );

    const blacklistedTokens = await TokenBlacklist.find({
      tokenHash: { $in: tokenHashes },
      expiresAt: { $gt: new Date() }
    });

    // Create a Set for faster lookup
    const blacklistedSet = new Set(blacklistedTokens.map(t => t.tokenHash));
    
    // Return object with token -> isBlacklisted mapping
    const result = {};
    tokens.forEach((token, index) => {
      result[token] = blacklistedSet.has(tokenHashes[index]);
    });

    return result;
  } catch (error) {
    console.error('Failed to check multiple tokens:', error);
    // Return all tokens as blacklisted on error (fail-safe)
    const result = {};
    tokens.forEach(token => {
      result[token] = true;
    });
    return result;
  }
};

// Export all functions
module.exports = {
  addToTokenBlacklist,
  isTokenBlacklisted,
  blacklistPreviousUserTokens,
  cleanupExpiredTokens,
  revokeToken,
  getBlacklistStats,
  isTokenHashBlacklisted,
  bulkBlacklistTokens,
  removeFromBlacklist,
  getUserBlacklistedTokens,
  checkMultipleTokens
};