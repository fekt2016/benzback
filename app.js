const express = require("express");
const cors = require("cors");
const app = express();

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
