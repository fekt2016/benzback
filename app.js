const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const cookieParser = require("cookie-parser");
const globalErrorHandler = require("./controllers/errorController");

const app = express();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 120000,
});
app.set("cloudinary", cloudinary);
app.use(cookieParser());
const isProduction = process.env.NODE_ENV === "production";
// CORS configuration
// Allow requests from the front-end domain, or use a wildcard for testing (not recommended for production)
const corsOptions = {
  origin: isProduction
    ? [
        "https://benzflex.com",
        "https://www.benzflex.com",
        "https://api.benzflex.com",
        process.env.FRONTEND_URL,
      ].filter(Boolean) // Remove any falsy values
    : true, // Allow all in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Role",
    "x-seller-subdomain",
    "x-admin-subdomain",
  ],
  exposedHeaders: ["Content-Range", "X-Total-Count"],
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
// Export the app instance
module.exports = app;
