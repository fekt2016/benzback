const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;

// Routers
const routers = {
  payment: require("./Routes/paymentRoutes"),
  user: require("./Routes/userRoutes"),
  car: require("./Routes/carRoutes"),
  drivers: require("./Routes/driverRoutes"),
  notification: require("./Routes/notificationRoutes"),
  review: require("./Routes/reviewRoutes"),
  booking: require("./Routes/bookingRoutes"),
  auth: require("./Routes/authRoutes"),
};
// Set memory limits first
process.env.NODE_OPTIONS = "--max-old-space-size=2048";
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
// Environment
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

// CORS Configuration - Best Practices
// const allowedOrigins = [
//   "http://localhost:5173", // Vite dev server
//   "http://127.0.0.1:5173",
//   "http://localhost:5174", // Alternative localhost
//   process.env.FRONTEND_URL, // Production frontend URL
// ].filter(Boolean);

// More secure CORS configuration
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

// Apply CORS middleware to all routes
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options(/.*/, cors(corsOptions));

// Log CORS-related requests
app.use((req, res, next) => {
  const origin = req.get("origin");
  console.log(
    `[CORS] ${req.method} ${req.originalUrl} from origin: ${
      origin || "unknown"
    }`
  );
  next();
});

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://cdnjs.cloudflare.com",
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://cdnjs.cloudflare.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc: [
              "'self'",
              "https://api.cloudinary.com",
              "http://localhost:5173",
              "http://localhost:5174",
              process.env.FRONTEND_URL,
            ].filter(Boolean),
          },
        }
      : false, // Disable in development for easier debugging
    crossOriginEmbedderPolicy: isProduction,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Remove the X-Powered-By header
app.disable("x-powered-by");

// Logging
if (isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
      stream: process.stderr,
    })
  );
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode >= 400,
      stream: process.stdout,
    })
  );
}

// Trust proxy
app.set("trust proxy", 1);

// Body parsing middleware
app.use(
  express.json({
    limit: isProduction ? "10mb" : "50mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        throw new AppError("Invalid JSON payload", 400);
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: isProduction ? "10mb" : "50mb",
    parameterLimit: isProduction ? 100 : 1000,
  })
);

// Security headers middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  // Security headers
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
});

// Routes
app.use("/api/v1/payment", routers.payment);
app.use("/api/v1/users", routers.user);
app.use("/api/v1/cars", routers.car);
app.use("/api/v1/drivers", routers.drivers);
app.use("/api/v1/notifications", routers.notification);
app.use("/api/v1/reviews", routers.review);
app.use("/api/v1/bookings", routers.booking);
app.use("/api/v1/auth", routers.auth);

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  console.log("Health check");
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Handle undefined routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
