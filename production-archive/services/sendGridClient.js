/**
 * SendGrid Client Singleton
 * 
 * WASM MEMORY OPTIMIZATION: Ensures SendGrid is configured once globally.
 * SendGrid uses HTTP clients internally that can allocate WebAssembly memory.
 * 
 * This ensures the same SendGrid client is reused across all email operations.
 */

const sgMail = require("@sendgrid/mail");

let sendGridConfigured = false;

/**
 * Initialize SendGrid singleton
 * Should be called once at application startup
 */
function initializeSendGrid() {
  if (sendGridConfigured) {
    return; // Already configured
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error("[SendGridClient] ❌ SENDGRID_API_KEY not set in environment variables!");
    return;
  }

  // WASM MEMORY OPTIMIZATION: Configure once, reuse everywhere
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sendGridConfigured = true;
  console.log("[SendGridClient] ✅ SendGrid singleton configured");
  console.log("[SendGridClient] 💡 This client will be reused to prevent WASM memory leaks");
}

/**
 * Get the configured SendGrid mail client
 * @returns {object} SendGrid mail client
 */
function getSendGrid() {
  if (!sendGridConfigured) {
    initializeSendGrid();
  }
  return sgMail;
}

/**
 * Reset the singleton (useful for testing)
 */
function resetSendGrid() {
  sendGridConfigured = false;
}

module.exports = {
  initializeSendGrid,
  getSendGrid,
  resetSendGrid,
  // Export the mail client directly for convenience
  get sgMail() {
    return getSendGrid();
  },
};

