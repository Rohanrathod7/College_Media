/**
 * ================================
 *  College Media – Backend Server
 *  Timeout-Safe | Large-File Ready
 *  Production Hardened
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
const helmet = require("helmet");
const securityHeaders = require("./config/securityHeaders");

const { initDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const resumeRoutes = require("./routes/resume");
const uploadRoutes = require("./routes/upload");

const { globalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { slidingWindowLimiter } = require("./middleware/slidingWindowLimiter");
const { warmUpCache } = require("./utils/cache");
const logger = require("./utils/logger");

// 🔍 Observability
const metricsMiddleware = require("./middleware/metrics.middleware");
const { client: metricsClient } = require("./utils/metrics");

/* ------------------
   🌱 ENV SETUP
------------------ */
dotenv.config();

const ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 5000;
const METRICS_TOKEN = process.env.METRICS_TOKEN || "metrics-secret";

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");

/* ------------------
   🔐 SECURITY HEADERS (HELMET)
------------------ */
app.use(helmet(securityHeaders(ENV)));

/* ------------------
   🌍 CORS
------------------ */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

/* ------------------
   📦 BODY PARSERS
------------------ */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ------------------
   📊 OBSERVABILITY – REQUEST METRICS
------------------ */
app.use(metricsMiddleware);

/* ------------------
   ⏱️ REQUEST TIMEOUT GUARD
------------------ */
app.use((req, res, next) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  next();
});

/* ------------------
   🐢 SLOW REQUEST LOGGER
------------------ */
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      logger.warn("Slow request detected", {
        method: req.method,
        url: req.originalUrl,
        durationMs: duration,
      });
    }
  });

  next();
});

/* ------------------
   🔁 API VERSIONING
------------------ */
app.use((req, res, next) => {
  req.apiVersion = req.headers["x-api-version"] || "v1";
  res.setHeader("X-API-Version", req.apiVersion);
  next();
});

/* ------------------
   ⏱️ RATE LIMITING
------------------ */
app.use("/api", slidingWindowLimiter);
if (ENV === "production") {
  app.use("/api", globalLimiter);
}

/* ------------------
   📁 STATIC FILES
------------------ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h",
    etag: true,
  })
);

/* ------------------
   ❤️ HEALTH CHECK
------------------ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "College Media API running",
    env: ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
  });
});

/* ------------------
   📈 PROMETHEUS METRICS (SECURED)
------------------ */
app.get("/metrics", async (req, res) => {
  const token = req.headers["x-metrics-token"];

  if (ENV === "production" && token !== METRICS_TOKEN) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  try {
    res.set("Content-Type", metricsClient.register.contentType);
    res.end(await metricsClient.register.metrics());
  } catch (err) {
    logger.error("Metrics endpoint failed", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to load metrics",
    });
  }
});

/* ------------------
   🚀 START SERVER
------------------ */
let dbConnection = null;

const startServer = async () => {
  try {
    dbConnection = await initDB();
    logger.info("Database connected");
  } catch (err) {
    logger.critical("DB connection failed", { error: err.message });
    process.exit(1);
  }

  /* 🔥 CACHE WARM-UP (NON-BLOCKING) */
  setImmediate(() => {
    warmUpCache({
      User: require("./models/User"),
      Resume: require("./models/Resume"),
    });
  });

  /* ---------- ROUTES ---------- */
  app.use("/api/auth", authLimiter, require("./routes/auth"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/resume", resumeRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/messages", require("./routes/messages"));
  app.use("/api/account", require("./routes/account"));

// Initialize database connection
const connectDB = async () => {
  let dbConnection;
  try {
    // Check if we are in test environment and using memory server
    // In test env, db connection might be handled by test setup, OR we can init it here
    // simpler to let test setup handle connection if it uses memory-server
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    dbConnection = await initDB();
    app.set('dbConnection', dbConnection);
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization error:', error);
    dbConnection = { useMongoDB: false, mongoose: null };
    app.set('dbConnection', dbConnection);
    logger.warn('Using file-based database as fallback');
  }
};

// Start server only if run directly
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  });
}

module.exports = app;
