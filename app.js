const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// Routes
app.use("/api/v1/auth", authRoutes);

// Global error handler (simplified)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message || "Something went wrong",
  });
});

module.exports = app;
