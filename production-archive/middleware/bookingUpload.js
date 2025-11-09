// bookingUploadMiddleware.js
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
// WASM MEMORY OPTIMIZATION: p-limit v7 is ES module, need to use .default in CommonJS
const pLimitModule = require("p-limit");
const pLimit = pLimitModule.default || pLimitModule;

// WASM MEMORY OPTIMIZATION: Limit concurrent Cloudinary uploads to prevent WASM memory exhaustion
// Each Cloudinary upload uses Undici internally, which allocates WebAssembly memory
// Limiting to 3 concurrent uploads prevents excessive WASM allocations
const uploadLimit = pLimit(3);

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
    const uniqueName = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) cb(null, true);
  else cb(new Error("Not an image!"), false);
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// --------- Booking-specific uploaders ---------
exports.uploadBookingFiles = upload.fields([
  { name: "insurance", maxCount: 1 }, // 1 insurance doc
  { name: "driverLicense", maxCount: 1 },
  { name: "licenseImage", maxCount: 1 }, // For driver profile uploads
  { name: "insuranceImage", maxCount: 1 }, // For driver profile uploads
  { name: "images", maxCount: 7 },
  { name: "damagePhotos", maxCount: 10 }, // multiple licenses
  { name: "carImages", maxCount: 10 },
]);

exports.processBookingFiles = async (req, res, next) => {
  const filesToCleanup = []; // Track files for cleanup
  
  try {
    const cloudinary = req.app.get("cloudinary");

    // Upload from file path (disk storage) instead of buffer
    const uploadFromFile = (filePath, folder, publicId) =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          filePath,
          {
            folder,
            public_id: publicId,
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (err, result) => {
            // Clean up temp file after upload
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            if (err) reject(err);
            else resolve(result.secure_url);
          }
        );
      });

    // WASM MEMORY OPTIMIZATION: Use p-limit to throttle concurrent Cloudinary uploads
    // This prevents multiple parallel HTTP requests from exhausting WebAssembly memory
    // Each upload uses Undici internally, which allocates WASM memory per request

    // -------- Insurance --------
    if (req.files && req.files.insurance) {
      const insuranceUrls = await Promise.all(
        req.files.insurance.map((file, i) => {
          filesToCleanup.push(file.path);
          // Limit concurrent uploads to prevent WASM memory exhaustion
          return uploadLimit(() => uploadFromFile(
            file.path,
            "insurance",
            `insurance-${Date.now()}-${i}`
          ));
        })
      );
      req.body.insuranceImage = insuranceUrls[0]; // only one
    }

    if (req.files && req.files.driverLicense) {
      const licenseUrls = await Promise.all(
        req.files.driverLicense.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(file.path, "license", `license-${Date.now()}-${i}`));
        })
      );
      req.body.licenseImage = licenseUrls[0];
    }

    // Handle driver profile license image upload
    if (req.files && req.files.licenseImage) {
      const licenseUrls = await Promise.all(
        req.files.licenseImage.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(file.path, "driver-licenses", `driver-license-${Date.now()}-${i}`));
        })
      );
      req.body.licenseImage = licenseUrls[0];
    }

    // Handle driver profile insurance image upload
    if (req.files && req.files.insuranceImage) {
      const insuranceUrls = await Promise.all(
        req.files.insuranceImage.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(file.path, "driver-insurance", `driver-insurance-${Date.now()}-${i}`));
        })
      );
      req.body.insuranceImage = insuranceUrls[0];
    }
    if (req.files && req.files.images) {
      const checkInImagesUrl = await Promise.all(
        req.files.images.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(file.path, "checkIn", `checkIn-${Date.now()}-${i}`));
        })
      );
      req.body.checkinImages = checkInImagesUrl;
    }
    if (req.files && req.files.carImages) {
      const carImagesUrl = await Promise.all(
        req.files.carImages.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(file.path, "carImage", `image-${Date.now()}-${i}`));
        })
      );
      req.body.carImages = carImagesUrl;
    }
    if (req.files && req.files.damagePhotos) {
      const damagePhotosUrl = await Promise.all(
        req.files.damagePhotos.map((file, i) => {
          filesToCleanup.push(file.path);
          return uploadLimit(() => uploadFromFile(
            file.path,
            "damagePhotos",
            `damagePhotos-${Date.now()}-${i}`
          ));
        })
      );
      req.body.damagePhotos = damagePhotosUrl;
    }

    // WASM MEMORY OPTIMIZATION: Clean up large variables and trigger GC after batch uploads
    // This helps free WebAssembly memory allocated by Undici during Cloudinary uploads
    filesToCleanup.length = 0; // Clear array reference
    if (global.gc && (req.files?.carImages?.length > 5 || req.files?.damagePhotos?.length > 5)) {
      // Trigger GC after large batch uploads (5+ files) to free WASM memory
      global.gc();
      console.log("🧹 GC triggered after batch Cloudinary uploads");
    }

    next();
  } catch (err) {
    // Cleanup any remaining files on error
    filesToCleanup.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error(`Error cleaning up file ${filePath}:`, cleanupErr);
        }
      }
    });
    next(err);
  }
};
