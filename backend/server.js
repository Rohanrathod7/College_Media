const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { initDB } = require('./config/db');
const { initSocket } = require('./socket');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimitMiddleware');
const { sanitizeAll, validateContentType, preventParameterPollution } = require('./middleware/sanitizationMiddleware');
const { setupSwagger } = require('./config/swagger');
const passport = require('./config/passport');
require('./utils/redisClient'); // Initialize Redis client

dotenv.config();


const app = express();
const server = http.createServer(app);
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
app.use(passport.initialize());

// Apply global rate limiter
// conditional check for test environment to avoid rate limits during testing
if (process.env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

// Apply input sanitization (XSS & NoSQL injection protection)
app.use(sanitizeAll);

// Validate Content-Type for POST/PUT/PATCH requests
app.use(validateContentType);

// Prevent parameter pollution
app.use(preventParameterPollution(['tags', 'categories'])); // Allow arrays for specific params

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: null,
    message: 'College Media API is running!'
  });
});

// Setup Swagger API documentation
setupSwagger(app);

// Import and register routes
const { versionMiddleware } = require('./middleware/versionMiddleware');

// Mount v1 routes
app.use('/api/v1', require('./routes/v1'));

// Mount v2 routes
app.use('/api/v2', require('./routes/v2'));

// Legacy routes (aliased to v1, marked as deprecated)
app.use('/api', versionMiddleware({
  deprecation: true,
  sunset: '2026-12-31T23:59:59Z',
  link: 'https://github.com/SatyamPandey-07/College_Media/wiki/API-Deprecation'
}), require('./routes/v1'));

// Admin routes (not versioned)
app.use('/api/admin', require('./routes/admin'));

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
    initSocket(server);

    // Start scheduler (only in production, not during tests)
    if (process.env.NODE_ENV !== 'test') {
      const scheduler = require('./jobs/scheduler');
      scheduler.start();
    }

    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  });
}

module.exports = app;