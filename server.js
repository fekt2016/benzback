const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const app = require("./app");

// Validate required environment variables
const requiredEnvVars = ["MONGO_URL", "MONGO_PASSWORD"];
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
  process.exit(1);
}

// MongoDB connection string
const mongodb = process.env.MONGO_URL.replace(
  "<PASSWORD>",
  process.env.MONGO_PASSWORD
);

// Global error handlers
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 🔥 Shutting down...");
  console.error("Error:", err.name, err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 🔥 Shutting down...");
  console.error("Error:", err.name, err.message);
  process.exit(1);
});

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    // Close HTTP server
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log("✅ HTTP server closed.");
          resolve();
        });
      });
    }

    // Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      console.log("✅ MongoDB connection closed.");
    }

    console.log("✅ Shutdown completed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error.message);
    process.exit(1);
  }
};

// Setup graceful shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Connect to MongoDB
const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(mongodb, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      //   useCreateIndex: true,
      //   useFindAndModify: false,
    });

    console.log("✅ Connected to MongoDB successfully");
    console.log(`📊 MongoDB Host: ${conn.connection.host}`);
    console.log(`🗃️  MongoDB Database: ${conn.connection.name}`);

    return true;
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    throw error;
  }
};

// Start the server
const startServer = async () => {
  try {
    const host = process.env.HOST || "0.0.0.0";
    const port = process.env.PORT || 3000;

    const server = app.listen(port, host, () => {
      console.log("🚀 Server initialization started...");
      console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📍 Listening on http://${host}:${port}`);

      if (process.env.NODE_ENV === "production") {
        console.log("✅ Production server is ready and running");
      }
    });

    // Handle server errors
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use`);
      } else {
        console.error("❌ Server error:", error.message);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    throw error;
  }
};

// Initialize application
const initializeApp = async () => {
  try {
    console.log("🔄 Starting application initialization...");

    await connectDatabase();
    const server = await startServer();

    console.log("✅ Application initialized successfully");
    return server;
  } catch (error) {
    console.error("❌ Failed to initialize application:", error.message);
    process.exit(1);
  }
};

// Start the application
let server;
initializeApp()
  .then((s) => {
    server = s;
  })
  .catch((error) => {
    console.error("💥 Application failed to start:", error);
    process.exit(1);
  });

// Export for testing purposes
module.exports = { initializeApp, gracefulShutdown };
