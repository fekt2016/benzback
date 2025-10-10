// avatarUploadMiddleware.js
const multer = require("multer");
const Stream = require("stream");

const multerStorage = multer.memoryStorage();

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
  try {
    // Check if file exists
    if (!req.file) {
      return next(); // No file to process, continue to next middleware
    }

    const cloudinary = req.app.get("cloudinary");

    // Helper function to upload from buffer
    const uploadFromBuffer = (buffer, folder, publicId) =>
      new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `car_rental/${folder}`,
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

        const bufferStream = new Stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
      });

    // Generate unique public ID
    const publicId = `avatar-${req.user?.id || "user"}-${Date.now()}`;

    // Upload avatar
    const uploadResult = await uploadFromBuffer(
      req.file.buffer,
      "avatars",
      publicId
    );

    // Add avatar URL and public ID to request body
    req.body.avatar = uploadResult.url;
    req.body.avatarPublicId = uploadResult.publicId;

    next();
  } catch (err) {
    console.error("Avatar upload error:", err);
    next(new Error("Failed to upload avatar image"));
  }
};

// Middleware to handle avatar removal
exports.handleAvatarRemoval = async (req, res, next) => {
  try {
    // Check if removeAvatar flag is set to true
    if (req.body.removeAvatar === "true" || req.body.removeAvatar === true) {
      const cloudinary = req.app.get("cloudinary");

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
