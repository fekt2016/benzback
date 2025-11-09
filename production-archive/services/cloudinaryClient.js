/**
 * Cloudinary Client Singleton
 * 
 * WASM MEMORY OPTIMIZATION: Ensures only ONE Cloudinary instance exists globally.
 * Cloudinary uses HTTP clients internally that can allocate WebAssembly memory.
 * 
 * This singleton ensures the same Cloudinary instance is reused across:
 * - app.js (initial configuration)
 * - bookingUpload.js middleware
 * - avatarUploadMiddleware.js middleware
 * - Any other file that needs Cloudinary
 */

const cloudinary = require("cloudinary").v2;

let cloudinaryInstance = null;

/**
 * Get or create the singleton Cloudinary instance
 * @returns {object|null} Cloudinary v2 instance or null if not configured
 */
function getCloudinary() {
  if (cloudinaryInstance) {
    return cloudinaryInstance;
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
  console.log("[CloudinaryClient] ✅ Singleton Cloudinary instance created");
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

