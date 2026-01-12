const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { initDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimitMiddleware');
const { sanitizeAll, validateContentType, preventParameterPollution } = require('./middleware/sanitizationMiddleware');
require('./utils/redisClient'); // Initialize Redis client

/* ------------------
   🔧 INTERNAL IMPORTS
------------------ */
const { initDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const resumeRoutes = require("./routes/resume");
const uploadRoutes = require("./routes/upload");
const { globalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { slidingWindowLimiter } = require("./middleware/slidingWindowLimiter");
const { warmUpCache } = require("./utils/cache");
const logger = require("./utils/logger");

// 🔍 Observability & Metrics
const metricsMiddleware = require("./middleware/metrics.middleware");
const { client: metricsClient } = require("./utils/metrics");

/* ------------------
   🌱 ENV SETUP
------------------ */
dotenv.config();

const ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Set security headers
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for now (if needed for development)
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"], // Allow images from https sources
    connectSrc: ["'self'"],
  },
}));
app.use(compression()); // Compress all responses
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply global rate limiter
// conditional check for test environment to avoid rate limits during testing
if (process.env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

// Apply input sanitization (XSS & NoSQL injection protection)
app.use(sanitizeAll);

  logger.info("Feature flags loaded", { env: ENV, FEATURE_FLAGS });
})();
/* ------------------
   📈 PROMETHEUS METRICS
------------------ */
app.get("/metrics", async (req, res) => {
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

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
if (FEATURE_FLAGS.ENABLE_STRICT_RATE_LIMITING) {
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

// Import and register routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/account', require('./routes/account'));

// 404 Not Found Handler (must be after all routes)
app.use(notFound);

// Global Error Handler (must be last)
app.use(errorHandler);

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
