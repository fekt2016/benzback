// const express = require("express");
// const dotenv = require("dotenv");
// const morgan = require("morgan");
// const cors = require("cors");
// dotenv.config({ path: "./config.env" });
// // Import your routers
// const authRouter = require("./routes/authRoutes");
// const carRouter = require("./routes/carRoutes");
// const notificationRouter = require("./routes/notificationRoutes");
// const driverRouter = require("./routes/driverRoutes");
// const bookingRouter = require("./routes/bookingRoutes");
// const paymentRouter = require("./routes/paymentRoutes");
// const reviewRouter = require("./routes/reviewRoutes");

// const cookieParser = require("cookie-parser");
// const cloudinary = require("cloudinary").v2;
// // const userRouter = require("./routes/userRoutes");

// const app = express();

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });
// app.set("cloudinary", cloudinary);

// // Middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// // CORS configuration
// // const allowedOrigins = [
// //   "http://localhost:5173", // development frontend
// //   "https://benzflex.com", // production frontend
// // ];

// // app.use(
// //   cors({
// //     origin: function (origin, callback) {
// //       if (!origin) return callback(null, true); // allow requests with no origin
// //       if (allowedOrigins.indexOf(origin) === -1) {
// //         const msg = `The CORS policy does not allow access from this Origin.`;
// //         return callback(new Error(msg), false);
// //       }
// //       return callback(null, true);
// //     },
// //     credentials: true, // allow cookies and auth headers
// //   })
// // );

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin (Samsung browser sometimes doesn't send origin)
//       if (!origin) return callback(null, true);

//       const allowedOrigins = [
//         "http://localhost:5173",
//         "benzflex.com",
//         "https://benzflex.com",
//         "http://127.0.0.1:5173",
//         "https://www.benzflex.com",
//         "file://", // For file:// URLs that Samsung browser might use
//         "null", // For null origins
//         // Add your specific domains here
//       ];

//       // Check if origin matches allowed origins or contains samsung-related domains
//       if (
//         allowedOrigins.includes(origin) ||
//         origin.includes("samsung") ||
//         origin.endsWith(".samsung") ||
//         isSamsungBrowserOrigin(origin)
//       ) {
//         return callback(null, true);
//       }

//       callback(new Error("Not allowed by CORS"));
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
//     allowedHeaders: [
//       "Content-Type",
//       "Authorization",
//       "X-Requested-With",
//       "Accept",
//       "Origin",
//       "Access-Control-Request-Method",
//       "Access-Control-Request-Headers",
//     ],
//     exposedHeaders: ["Content-Length", "Authorization"],
//     preflightContinue: false,
//     optionsSuccessStatus: 204,
//     maxAge: 86400, // 24 hours - helps with caching preflight requests
//   })
// );

// // Helper function to detect Samsung browser origins
// function isSamsungBrowserOrigin(origin) {
//   const samsungPatterns = [
//     /samsung/i,
//     /sec\./i, // Samsung internet browser patterns
//     /\.samsung\./i,
//   ];
//   return samsungPatterns.some((pattern) => pattern.test(origin));
// }

// // Logging (only in development)
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// }

// // API CALL logger (only in production)
// app.use((req, res, next) => {
//   if (process.env.NODE_ENV === "production") {
//     console.log(`[API CALL] ${req.method} ${req.originalUrl}`);
//     if (req.body && Object.keys(req.body).length > 0) {
//       console.log("Body:", req.body);
//     }
//     if (req.query && Object.keys(req.query).length > 0) {
//       console.log("Query:", req.query);
//     }
//   }
//   next();
// });

// // ========================
// // API Routes
// // ========================
// app.use("/api/v1/auth", authRouter);
// app.use("/api/v1/cars", carRouter);
// app.use("/api/v1/notifications", notificationRouter);
// app.use("/api/v1/drivers", driverRouter);
// app.use("/api/v1/bookings", bookingRouter);
// app.use("/api/v1/payment", paymentRouter);
// app.use("/api/v1/reviews", reviewRouter);

// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.statusCode || 500).json({
//     status: "error",
//     message: err.message || "Internal Server Error",
//   });
// });

// module.exports = app;
const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
dotenv.config({ path: "./config.env" });
// Import your routers
const authRouter = require("./routes/authRoutes");
const carRouter = require("./routes/carRoutes");
const notificationRouter = require("./routes/notificationRoutes");
const driverRouter = require("./routes/driverRoutes");
const bookingRouter = require("./routes/bookingRoutes");
const paymentRouter = require("./routes/paymentRoutes");
const reviewRouter = require("./routes/reviewRoutes");

const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;
// const userRouter = require("./routes/userRoutes");

const app = express();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.set("cloudinary", cloudinary);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enhanced CORS configuration with Samsung browser logging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const userAgent = req.headers["user-agent"] || "";

  // Log all Samsung browser requests to see what origin they're sending
  if (
    userAgent.includes("Samsung") ||
    userAgent.includes("SAMSUNG") ||
    userAgent.includes("sec")
  ) {
    console.log("=== SAMSUNG BROWSER DETECTED ===");
    console.log("Origin:", origin);
    console.log("User-Agent:", userAgent);
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("==============================");
  }

  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, some browsers)
      if (!origin) {
        console.log("CORS: Allowing request with no origin");
        return callback(null, true);
      }

      const allowedOrigins = [
        "http://localhost:5173",
        "https://benzflex.com",
        "http://benzflex.com",
        "http://127.0.0.1:5173",
        "https://www.benzflex.com",
        "http://www.benzflex.com",
        "file://",
        "null",
        "https://mobile.benzflex.com", // Add mobile subdomain if needed
        "http://mobile.benzflex.com",
      ];

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log("CORS: Allowing origin from allowed list:", origin);
        return callback(null, true);
      }

      // Special handling for Samsung browsers - be more permissive
      const userAgent =
        require("express")().request?.headers?.["user-agent"] || "";
      if (
        userAgent.includes("Samsung") ||
        userAgent.includes("SAMSUNG") ||
        userAgent.includes("sec")
      ) {
        console.log("CORS: Allowing Samsung browser with origin:", origin);
        return callback(null, true);
      }

      // Check for subdomains of benzflex.com
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname.endsWith(".benzflex.com")) {
          console.log("CORS: Allowing subdomain origin:", origin);
          return callback(null, true);
        }
      } catch (e) {
        // URL parsing failed, continue to error
      }

      console.log("CORS: Blocked origin:", origin);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Length", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

// Helper function to detect Samsung browser origins
function isSamsungBrowserOrigin(origin) {
  const samsungPatterns = [/samsung/i, /sec\./i, /\.samsung\./i];
  return samsungPatterns.some((pattern) => pattern.test(origin));
}

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
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/drivers", driverRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/reviews", reviewRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
