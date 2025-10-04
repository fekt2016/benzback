const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
dotenv.config({ path: "./config.env" });
// Import your routers
const authRouter = require("./routes/authRoutes");
const carRouter = require("./routes/carRoutes");

const cookieParser = require("cookie-parser");

// const userRouter = require("./routes/userRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// CORS configuration
const allowedOrigins = [
  "http://localhost:5173", // development frontend
  "https://benzflex.com", // production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow requests with no origin
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy does not allow access from this Origin.`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // allow cookies and auth headers
  })
);

// Logging (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// API CALL logger (only in production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    console.log(`[API CALL] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("Body:", req.body);
    }
    if (req.query && Object.keys(req.query).length > 0) {
      console.log("Query:", req.query);
    }
  }
  next();
});

// ========================
// API Routes
// ========================
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/cars", carRouter);
// app.use("/api/users", userRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
