/**
 * SendGrid Client Singleton (Lazy Loading)
 * 
 * LAZY LOADING OPTIMIZATION: SendGrid module is only loaded when first needed.
 * This prevents WebAssembly memory allocation at application startup.
 * 
 * WASM MEMORY OPTIMIZATION: Ensures SendGrid is configured once globally.
 * SendGrid uses HTTP clients internally that can allocate WebAssembly memory.
 * 
 * This ensures the same SendGrid client is reused across all email operations.
 */

let sgMail = null; // Will be loaded lazily
let sendGridConfigured = false;

/**
 * Initialize SendGrid singleton (lazy loading)
 * Called automatically on first use via getSendGrid()
 */
function initializeSendGrid() {
  if (sendGridConfigured) {
    return; // Already configured
  }

  // LAZY LOADING: Only require SendGrid module when first needed
  // This prevents WASM memory allocation at application startup
  if (!sgMail) {
    try {
      sgMail = require("@sendgrid/mail");
      console.log("[SendGridClient] 📦 SendGrid module loaded (lazy initialization)");
    } catch (error) {
      console.error("[SendGridClient] ❌ Failed to load SendGrid module:", error.message);
      return;
    }
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error("[SendGridClient] ❌ SENDGRID_API_KEY not set in environment variables!");
    return;
  }

  // WASM MEMORY OPTIMIZATION: Configure once, reuse everywhere
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sendGridConfigured = true;
  console.log("[SendGridClient] ✅ SendGrid singleton configured - LAZY LOADED");
  console.log("[SendGridClient] 💡 This client will be reused to prevent WASM memory leaks");
}

/**
 * Get the configured SendGrid mail client (lazy loading)
 * @returns {object|null} SendGrid mail client or null if not configured
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

