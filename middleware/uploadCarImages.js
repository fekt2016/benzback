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
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// frontend must send files with key "images"
exports.uploadCarImages = upload.array("images", 10);

exports.processCarImages = async (req, res, next) => {
  try {
    const cloudinary = req.app.get("cloudinary");

    // Helper: upload one file buffer to Cloudinary
    const uploadFromBuffer = (buffer, publicId) =>
      new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "cars",
            public_id: publicId,
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result.secure_url);
          }
        );
        const bufferStream = new Stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
      });

    // If no new files → just move on
    if (!req.files || req.files.length === 0) {
      return next();
    }

    // Upload new files
    const uploadedUrls = await Promise.all(
      req.files.map((file, i) =>
        uploadFromBuffer(file.buffer, `car-${Date.now()}-${i}`)
      )
    );

    /**
     * For createCar: req.body.images will be set to uploadedUrls only.
     * For updateCar: we may already have existing URLs in req.body.images.
     *
     * - If frontend sends images=[] → user wants to remove all old ones,
     *   we replace with just uploadedUrls.
     * - If frontend sends images with URLs → keep them and add new ones.
     */
    let existingUrls = [];
    if (req.body.images) {
      try {
        existingUrls =
          typeof req.body.images === "string"
            ? JSON.parse(req.body.images)
            : req.body.images;
      } catch (e) {
        existingUrls = Array.isArray(req.body.images)
          ? req.body.images
          : [req.body.images];
      }
    }

    req.body.images = [...existingUrls, ...uploadedUrls];

    next();
  } catch (err) {
    next(err);
  }
};
