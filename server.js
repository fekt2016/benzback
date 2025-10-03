const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config({ path: "./config.env" });

const PORT = process.env.PORT || 3000;
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
      if (app._router && app._router.stack) {
        const getRoutes = (stack, basePath = "") => {
          let routes = [];
          stack.forEach((middleware) => {
            if (middleware.route) {
              const method = Object.keys(
                middleware.route.methods
              )[0].toUpperCase();
              routes.push(`${method} ${basePath}${middleware.route.path}`);
            } else if (
              middleware.name === "router" &&
              middleware.handle.stack
            ) {
              routes = routes.concat(
                getRoutes(
                  middleware.handle.stack,
                  basePath +
                    (middleware.regexp?.source
                      .replace("^\\/", "/")
                      .replace("\\/?(?=\\/|$)", "") || "")
                )
              );
            }
          });
          return routes;
        };

        const routes = getRoutes(app._router.stack);
        console.log("✅ Registered routes:");
        console.log(
          routes.length > 0 ? routes.join("\n") : "⚠️ No routes found!"
        );
      } else {
        console.log("⚠️ No routes registered yet!");
      }
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
