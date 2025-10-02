const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const cookieParser = require("cookie-parser");
const globalErrorHandler = require("./controllers/errorController");
const AppError = require("./utils/appError");

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
const routers = {
  payment: require("./routes/paymentRoutes"),
  user: require("./routes/userRoutes"),
  car: require("./routes/carRoutes"),
  drivers: require("./routes/driverRoutes"),
  notification: require("./routes/notificationRoutes"),
  review: require("./routes/reviewRoutes"),
  booking: require("./routes/bookingRoutes"),
  auth: require("./routes/authRoutes"),
};

// CORS configuration

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
// Allow requests from the front-end domain, or use a wildcard for testing (not recommended for production)
const corsOptions = {
  origin: isProduction
    ? [
        "https://benzflex.com",
        "https://www.benzflex.com",
        "https://api.benzflex.com",
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

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors(corsOptions));

app.use("/api/v1/payment", routers.payment);
app.use("/api/v1/users", routers.user);
app.use("/api/v1/cars", routers.car);
app.use("/api/v1/drivers", routers.drivers);
app.use("/api/v1/notifications", routers.notification);
app.use("/api/v1/reviews", routers.review);
app.use("/api/v1/bookings", routers.booking);
app.use("/api/v1/auth", routers.auth);

app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
// Export the app instance
module.exports = app;
