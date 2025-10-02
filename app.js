const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");

// Import your routers
const authRouter = require("./routes/authRoutes");
// const userRouter = require("./routes/userRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173", // development frontend
  "https://benzflex.com", // production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
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
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    console.log(`[API CALL] ${req.method} ${req.originalUrl}`);
    // Optional: log body
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("Body:", req.body);
    }
    // Optional: log query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      console.log("Query:", req.query);
    }
  }
  next();
});

// API Routes
app.use("/api/v1/auth", authRouter);
// app.use("/api/users", userRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.log(req.config);
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});
console.log("🚀 Registered routes:");
console.log(
  app._router.stack
    .filter((r) => r.route) // only keep layers with a route
    .map(
      (r) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`
    )
);

module.exports = app;
