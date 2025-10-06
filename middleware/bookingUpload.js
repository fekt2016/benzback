// bookingUploadMiddleware.js
const multer = require("multer");
const Stream = require("stream");

const multerStorage = multer.memoryStorage();

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
  { name: "driverLicense", maxCount: 1 }, // multiple licenses
]);

exports.processBookingFiles = async (req, res, next) => {
  try {
    const cloudinary = req.app.get("cloudinary");

    const uploadFromBuffer = (buffer, folder, publicId) =>
      new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (err, result) => (err ? reject(err) : resolve(result.secure_url))
        );

        const bufferStream = new Stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
      });

    // -------- Insurance --------
    if (req.files && req.files.insurance) {
      const insuranceUrls = await Promise.all(
        req.files.insurance.map((file, i) =>
          uploadFromBuffer(
            file.buffer,
            "insurance",
            `insurance-${Date.now()}-${i}`
          )
        )
      );
      req.body.insuranceImage = insuranceUrls[0]; // only one
    }

    if (req.files && req.files.driverLicense) {
      const licenseUrls = await Promise.all(
        req.files.driverLicense.map((file, i) =>
          uploadFromBuffer(file.buffer, "license", `license-${Date.now()}-${i}`)
        )
      );
      req.body.licenseImage = licenseUrls[0];
    }

    next();
  } catch (err) {
    next(err);
  }
};
