const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const sanitizeHtml = require("sanitize-html");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Load env vars (must be before any other imports that use process.env)
dotenv.config({ path: "./config.env" });

// Routers
const authRouter = require("./routes/authRoutes");
const carRouter = require("./routes/carRoutes");
const notificationRouter = require("./routes/notificationRoutes");
const driverRouter = require("./routes/driverRoutes");
const driverProfileRouter = require("./routes/driverProfileRoutes");
const professionalDriverRouter = require("./routes/professionalDriverRoutes");
const bookingRouter = require("./routes/bookingRoutes");
const paymentRouter = require("./routes/paymentRoutes");
const reviewRouter = require("./routes/reviewRoutes");
const userRouter = require("./routes/userRoutes");
const couponRouter = require("./routes/couponRoutes");
const chatRouter = require("./routes/chatRoutes");
const activityRouter = require("./routes/activityRoutes");
const debugRouter = require("./routes/debugRoutes");

const app = express();

/* =========================
   Cloudinary Configuration
========================= */
// Only configure Cloudinary if all required env vars are present
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  app.set("cloudinary", cloudinary);
  console.log("✅ Cloudinary configured");
} else {
  console.warn("⚠️  Cloudinary not configured - missing environment variables");
}

/* =========================
   Security Middlewares
========================= */
const isDevelopment = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'", "http:", "https:"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              "https://js.stripe.com",
              "https://r.stripe.com",
              "http:",
              "https:",
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://js.stripe.com",
            ],
            fontSrc: [
              "'self'",
              "https://fonts.gstatic.com",
              "https://fonts.googleapis.com",
            ],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: [
              "'self'",
              "https://api.stripe.com",
              "https://r.stripe.com",
              "https://checkout.stripe.com",
              "https://js.stripe.com",
              "http:",
              "https:",
            ],
            frameSrc: [
              "'self'",
              "https://js.stripe.com",
              "https://hooks.stripe.com",
              "https://checkout.stripe.com",
            ],
            objectSrc: ["'none'"],
          },
        },
  })
);

// Mongo sanitize wrapper
app.use((req, res, next) => {
  try {
    mongoSanitize()(req, res, next);
  } catch (err) {
    console.warn("mongo-sanitize skipped:", err.message);
    next();
  }
});

/* =========================
   Stripe Webhook (raw)
========================= */
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  require("./controllers/webhookController").handleStripeWebhook
);

/* =========================
   Rate Limiting
========================= */
// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply rate limiting to API routes
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/", apiLimiter);

/* =========================
   Parsers (with size limits)
========================= */
app.use(express.json({ limit: "10mb" })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Limit URL-encoded payload size
app.use(cookieParser());

/* =========================
   Input Sanitization
========================= */
app.use((req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = sanitizeHtml(obj[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
});

/* =========================
   CORS Setup (must be early, after helmet)
========================= */
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const isDevelopment = process.env.NODE_ENV !== "production";
      if (isDevelopment) {
        try {
          const originUrl = new URL(origin);
          const hostname = originUrl.hostname.toLowerCase();
          if (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname.startsWith("192.168.") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("172.")
          ) {
            console.log(`[CORS] Allowing dev origin: ${origin}`);
            return callback(null, true);
          }
        } catch (e) {}
      }

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://benzflex.com",
        "https://www.benzflex.com",
        "https://mobile.benzflex.com",
      ];

      if (allowedOrigins.includes(origin)) return callback(null, true);

      try {
        const originUrl = new URL(origin);
        if (
          originUrl.hostname.endsWith(".benzflex.com") ||
          originUrl.hostname === "benzflex.com"
        ) {
          return callback(null, true);
        }
      } catch (e) {}

      console.error(`[CORS] Rejected origin: ${origin}`);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

app.use(compression());

/* =========================
   HTTPS Redirect in Production
========================= */
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

/* =========================
   Logging
========================= */
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
app.set("trust proxy", 1);

/* =========================
   API Routes
========================= */
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/cars", carRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/drivers", driverRouter);
app.use("/api/v1/driver", driverProfileRouter);
app.use("/api/v1/professional-drivers", professionalDriverRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/coupons", couponRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/activity", activityRouter);
app.use("/api/v1/debug", debugRouter);

/* =========================
   404 Handler for API Routes
========================= */
// Use middleware without route pattern to avoid path-to-regexp issues with Express 4
// This will catch any unmatched API routes after all route handlers
app.use((req, res, next) => {
  // Only handle unmatched API routes (if path starts with /api and no response sent)
  if (req.path.startsWith("/api")) {
    // If we reach here and headers aren't sent, it means no route matched
    if (!res.headersSent) {
      return res.status(404).json({
        status: "fail",
        message: `Cannot find ${req.method} ${req.originalUrl} on this server`,
      });
    }
  }
  // For non-API routes, continue to next middleware (frontend serving)
  next();
});

/* =========================
   Serve Frontend (Production)
========================= */
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(frontendDistPath));

  // ✅ Express 4 compatible catch-all middleware for React SPA
  // Using middleware instead of route to avoid path-to-regexp issues
  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Skip if request is for a static file that exists
    // (express.static handles those above)
    // For all other routes, serve index.html
    res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
      if (err) {
        console.error("[Static] Error serving index.html:", err);
        res.status(500).send("Error loading application");
      }
    });
  });
}

/* =========================
   Global Error Handler
========================= */
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const statusCode = err.statusCode || 500;
  const status = err.status || (statusCode >= 500 ? "error" : "fail");

  console.error(`\n[${timestamp}] ❌ GLOBAL ERROR HANDLER`);
  console.error(`Method: ${req.method}`);
  console.error(`Path: ${req.originalUrl}`);
  console.error(`Status: ${statusCode}`);
  console.error(`Message: ${err.message}`);
  console.error(`Stack:\n${err.stack}\n`);

  res.status(statusCode).json({
    status,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
