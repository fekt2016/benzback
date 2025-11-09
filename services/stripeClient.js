/**
 * Stripe Client Singleton
 * 
 * WASM MEMORY OPTIMIZATION: Ensures only ONE Stripe instance exists globally.
 * Prevents multiple Undici HTTP client instances from being created.
 * 
 * Each Stripe instance creates its own HTTP client (using Undici internally),
 * which allocates WebAssembly memory. Multiple instances = multiple WASM allocations.
 */

const Stripe = require("stripe");

let stripeInstance = null;

/**
 * Get or create the singleton Stripe instance
 * @returns {Stripe|null} Stripe instance or null if not configured
 */
function getStripe() {
  if (stripeInstance) {
    return stripeInstance;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[StripeClient] ❌ STRIPE_SECRET_KEY not configured");
    return null;
  }

  // WASM MEMORY OPTIMIZATION: Create single instance
  // This instance will be reused across all controllers
  // Stripe uses Undici internally, which allocates WebAssembly memory
  // By using a singleton, we ensure only ONE Undici instance exists
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Optimize HTTP client settings to reduce memory
    maxNetworkRetries: 2,
    timeout: 20000,
  });

  const keyType = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`[StripeClient] ✅ Singleton Stripe instance created (${keyType} mode)`);
  console.log(`[StripeClient] 💡 This instance will be reused across all controllers to prevent WASM memory leaks`);

  return stripeInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
function resetStripe() {
  stripeInstance = null;
}

module.exports = {
  getStripe,
  resetStripe,
  // Export a getter that returns the instance (for convenience)
  get stripe() {
    return getStripe();
  },
};

