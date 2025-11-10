// avatarUploadMiddleware.js
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Use disk storage to reduce memory usage (important for cPanel)
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use system temp directory
    const uploadDir = path.join(os.tmpdir(), "benz-uploads");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload an image file."), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1, // Only allow 1 file
  },
});

// --------- Avatar-specific uploaders ---------
exports.uploadAvatar = upload.single("avatar");

exports.processAvatar = async (req, res, next) => {
  console.log("Processing avatar...", req.file);
  let tempFilePath = null;
  
  try {
    // Check if file exists
    if (!req.file) {
      return next(); // No file to process, continue to next middleware
    }

    tempFilePath = req.file.path; // Store path for cleanup
    
    // LAZY LOAD: Get Cloudinary instance on first use (not at module load)
    // This prevents WASM memory allocation at application startup
    const { getCloudinary } = require("../services/cloudinaryClient");
    const cloudinary = getCloudinary();
    
    if (!cloudinary) {
      return next(new Error("Cloudinary is not configured"));
    }

    // Generate unique public ID
    const publicId = `avatar-${req.user?.id || "user"}-${Date.now()}`;

    // Upload from file path (disk storage) instead of buffer
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        tempFilePath,
        {
          folder: `car_rental/avatars`,
          public_id: publicId,
          transformation: [
            {
              width: 500,
              height: 500,
              crop: "fill",
              gravity: "face",
              quality: "auto",
              fetch_format: "auto",
            },
          ],
        },
        (err, result) => {
          // Clean up temp file after upload
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null; // Mark as cleaned
          }
          
          if (err) {
            reject(err);
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }
      );
    });

    // Add avatar URL and public ID to request body
    req.body.avatar = uploadResult.url;
    req.body.avatarPublicId = uploadResult.publicId;

    next();
  } catch (err) {
    // Cleanup temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error(`Error cleaning up avatar file:`, cleanupErr);
      }
    }
    console.error("Avatar upload error:", err);
    next(new Error("Failed to upload avatar image"));
  }
};

// Middleware to handle avatar removal
exports.handleAvatarRemoval = async (req, res, next) => {
  try {
    // Check if removeAvatar flag is set to true
    if (req.body.removeAvatar === "true" || req.body.removeAvatar === true) {
      // LAZY LOAD: Get Cloudinary instance on first use (not at module load)
      const { getCloudinary } = require("../services/cloudinaryClient");
      const cloudinary = getCloudinary();
      
      if (!cloudinary) {
        return next(new Error("Cloudinary is not configured"));
      }

      // If user has existing avatar, delete it from Cloudinary
      if (req.user?.avatarPublicId) {
        try {
          await cloudinary.uploader.destroy(req.user.avatarPublicId);
          console.log(`Deleted old avatar: ${req.user.avatarPublicId}`);
        } catch (deleteError) {
          console.error("Error deleting old avatar:", deleteError);
          // Continue even if deletion fails
        }
      }

      // Set avatar to null
      req.body.avatar = null;
      req.body.avatarPublicId = null;
    }

    next();
  } catch (err) {
    console.error("Avatar removal error:", err);
    next(err);
  }
};

// Combined middleware for avatar operations
exports.handleAvatarUpload = [
  exports.uploadAvatar,
  exports.handleAvatarRemoval,
  exports.processAvatar,
];

// Utility function to delete avatar from Cloudinary
exports.deleteAvatarFromCloudinary = async (publicId, cloudinary) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`Successfully deleted avatar: ${publicId}`);
  } catch (error) {
    console.error("Error deleting avatar from Cloudinary:", error);
    throw error;
  }
};
