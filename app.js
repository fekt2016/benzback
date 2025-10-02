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

// CORS configuration
// Allow requests from the front-end domain, or use a wildcard for testing (not recommended for production)
const corsOptions = {
  origin: process.env.ORIGIN || "*", // In production, set ORIGIN to your front-end URL
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Export the app instance
module.exports = app;
