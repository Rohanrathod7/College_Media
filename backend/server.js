const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { initDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------
// 🔐 GLOBAL MIDDLEWARES
// ------------------

// ✅ FIXED: Proper CORS Configuration (Preflight Support)
const corsOptions = {
  origin: true, // allow all origins (or frontend URL)
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

// ✅ FIXED: Explicitly handle OPTIONS (preflight) requests
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------
// 🔁 API VERSION HANDLING
// ------------------
app.use((req, res, next) => {
  req.apiVersion = req.headers["x-api-version"] || "v1";
  res.setHeader("X-API-Version", req.apiVersion);
  next();
});

// ------------------
// ⏱️ RATE LIMITING
// ------------------
app.use("/api", slidingWindowLimiter);
app.use("/api", globalLimiter);

// ------------------
// 📁 STATIC FILES
// ------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------
// ❤️ HEALTH CHECK
// ------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    apiVersion: req.apiVersion,
    message: "College Media API is running!",
  });
});

// ------------------
// 🚀 START SERVER
// ------------------
const startServer = async () => {
  let dbConnection;

  try {
    dbConnection = await initDB();

    // Set the database connection globally so routes can access it
    app.set('dbConnection', dbConnection);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization error:', error);
    // Don't exit, just use mock database
    dbConnection = { useMongoDB: false, mongoose: null };
    app.set('dbConnection', dbConnection);

    logger.warn('Using file-based database as fallback');
  }

  // Import and register routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/account', require('./routes/account'));

  // 404 Not Found Handler (must be after all routes)
  app.use(notFound);

  // Global Error Handler (must be last)
  app.use(errorHandler);

  // Start the server
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
};

startServer();
