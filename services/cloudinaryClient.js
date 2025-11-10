/**
 * Cloudinary Client Singleton (Lazy Loading)
 * 
 * LAZY LOADING OPTIMIZATION: Cloudinary module is only loaded when first needed.
 * This prevents WebAssembly memory allocation at application startup.
 * 
 * WASM MEMORY OPTIMIZATION: Ensures only ONE Cloudinary instance exists globally.
 * Cloudinary uses HTTP clients internally that can allocate WebAssembly memory.
 * 
 * This singleton ensures the same Cloudinary instance is reused across:
 * - bookingUpload.js middleware
 * - avatarUploadMiddleware.js middleware
 * - Any other file that needs Cloudinary
 */

let cloudinary = null; // Will be loaded lazily
let cloudinaryInstance = null;

/**
 * Get or create the singleton Cloudinary instance (lazy loading)
 * @returns {object|null} Cloudinary v2 instance or null if not configured
 */
function getCloudinary() {
  // Return existing instance if already created
  if (cloudinaryInstance) {
    return cloudinaryInstance;
  }

  // LAZY LOADING: Only require Cloudinary module when first needed
  // This prevents WASM memory allocation at application startup
  if (!cloudinary) {
    try {
      cloudinary = require("cloudinary").v2;
      console.log("[CloudinaryClient] 📦 Cloudinary module loaded (lazy initialization)");
    } catch (error) {
      console.error("[CloudinaryClient] ❌ Failed to load Cloudinary module:", error.message);
      return null;
    }
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.warn("[CloudinaryClient] ⚠️  Cloudinary not configured - missing environment variables");
    return null;
  }

  // WASM MEMORY OPTIMIZATION: Configure once, reuse everywhere
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  cloudinaryInstance = cloudinary;
  console.log("[CloudinaryClient] ✅ Singleton Cloudinary instance created - LAZY LOADED");
  console.log("[CloudinaryClient] 💡 This instance will be reused to prevent WASM memory leaks");

  return cloudinaryInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
function resetCloudinary() {
  cloudinaryInstance = null;
}

module.exports = {
  getCloudinary,
  resetCloudinary,
  // Export a getter that returns the instance (for convenience)
  get cloudinary() {
    return getCloudinary();
  },
};

