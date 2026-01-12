/**
 * ================================
 *  College Media – Backend Server
 *  Memory-Safe | Production Ready
 * ================================
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const os = require("os");

/* ------------------
   🔧 INTERNAL IMPORTS
------------------ */
const { initDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const resumeRoutes = require("./routes/resume");
const uploadRoutes = require("./routes/upload");
const { globalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { slidingWindowLimiter } = require("./middleware/slidingWindowLimiter");
const logger = require("./utils/logger"); // 🔥 ADDED

/* ------------------
   🌱 ENV SETUP
------------------ */
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Disable unnecessary header
app.disable("x-powered-by");

/* ------------------
   🌍 CORS CONFIG
------------------ */
const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-API-Version",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ------------------
   📦 BODY PARSERS
------------------ */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ------------------
   🔁 API VERSIONING
------------------ */
app.use((req, res, next) => {
  req.apiVersion = req.headers["x-api-version"] || "v1";
  res.setHeader("X-API-Version", req.apiVersion);
  next();
});

/* ------------------
   ⏱️ REQUEST TIMEOUT
------------------ */
app.use((req, res, next) => {
  res.setTimeout(30 * 1000, () => {
    logger.warn("Request timeout", {
      method: req.method,
      url: req.originalUrl,
    });

    res.status(408).json({
      success: false,
      message: "Request timeout",
    });
  });
  next();
});

/* ------------------
   ⏱️ RATE LIMITING
------------------ */
app.use("/api", slidingWindowLimiter);
app.use("/api", globalLimiter);

/* ------------------
   📊 REQUEST LOGGING
------------------ */
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn("Slow request detected", {
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
      });
    }
  });

  next();
});

/* ------------------
   📁 STATIC FILES
------------------ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h",
    etag: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

/* ------------------
   ❤️ HEALTH CHECK
------------------ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    apiVersion: req.apiVersion,
    message: "College Media API is running!",
    uptime: process.uptime(),
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
    },
    cpu: os.loadavg(),
  });
});

/* ------------------
   🚀 START SERVER
------------------ */
let dbConnection = null;

const startServer = async () => {
  try {
    dbConnection = await initDB();
    logger.info("Database initialized successfully");
  } catch (err) {
    logger.critical("Database initialization failed", {
      error: err.message,
    });
    dbConnection = null;
  }

  /* ------------------
     🔐 ROUTES
  ------------------ */
  app.use("/api/auth", authLimiter, require("./routes/auth"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/resume", resumeRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/messages", require("./routes/messages"));
  app.use("/api/account", require("./routes/account"));
  app.use("/api/notifications", require("./routes/notifications"));

  /* ------------------
     ❌ ERROR HANDLING
  ------------------ */
  app.use(notFound);
  app.use(errorHandler);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

/* ------------------
   🧹 GRACEFUL SHUTDOWN
------------------ */
const shutdown = async (signal) => {
  logger.warn("Shutdown signal received", { signal });

  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      if (dbConnection?.mongoose) {
        await dbConnection.mongoose.connection.close(false);
        logger.info("MongoDB connection closed");
      }
    } catch (err) {
      logger.error("Error closing DB connection", {
        error: err.message,
      });
    }

    process.exit(0);
  });

  setTimeout(() => {
    logger.critical("Force shutdown due to timeout");
    process.exit(1);
  }, 10 * 1000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/* ------------------
   🧨 PROCESS SAFETY (NO SILENT FAIL)
------------------ */
process.on("unhandledRejection", (reason) => {
  logger.critical("Unhandled Promise Rejection", {
    reason,
  });
});

process.on("uncaughtException", (err) => {
  logger.critical("Uncaught Exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

/* ------------------
   🚦 SERVER TUNING
------------------ */
server.keepAliveTimeout = 60 * 1000;
server.headersTimeout = 65 * 1000;

/* ------------------
   ▶️ BOOTSTRAP
------------------ */
startServer();
