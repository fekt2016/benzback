const mongoose = require("mongoose");

const app = require("./app");

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const startServer = async () => {
  try {
    const db = process.env.MONGO_URL.replace(
      `<PASSWORD>`,
      process.env.MONGO_PASSWORD
    );
    // MongoDB connection
    const conn = await mongoose.connect(db, { maxPoolSize: 10 });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Start Express server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Closing...`);
      await mongoose.connection.close(false);
      server.close(() => console.log("✅ Server closed."));
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Server startup error:", err);
    process.exit(1);
  }
};

startServer();
