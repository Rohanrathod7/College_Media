const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log directory
const logDir = path.join(__dirname, '../logs');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Start valid keys to redact
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie', 'otp'];

// Redaction formatter
const redactSensitiveData = winston.format((info) => {
    const maskSensitive = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        // Handle specific object types we don't want to traverse
        if (obj instanceof Date) return obj;
        if (Array.isArray(obj)) return obj.map(maskSensitive);

        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
                    newObj[key] = '***REDACTED***';
                } else if (typeof obj[key] === 'object') {
                    newObj[key] = maskSensitive(obj[key]);
                } else {
                    newObj[key] = obj[key];
                }
            }
        }
        return newObj;
    };

    if (info.message && typeof info.message === 'object') {
        info.message = maskSensitive(info.message);
    }

    // Also mask metadata if present
    if (info.metadata) {
        info.metadata = maskSensitive(info.metadata);
    }

    return info;
});

// Configure the current environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'info';
};

// Tell winston about our colors
winston.addColors(colors);

// Define format
const format = winston.format.combine(
    redactSensitiveData(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${typeof info.message === 'object' ? JSON.stringify(info.message) : info.message}`
    )
);

// Define transports
const transports = [
    // Console Transport
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.printf(
                (info) => `${info.timestamp} ${info.level}: ${typeof info.message === 'object' ? JSON.stringify(info.message, null, 2) : info.message}`
            )
        ),
    }),

    // File Transport - Error Logs
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'error',
        format: winston.format.combine(
            winston.format.json()
        )
    }),

    // File Transport - All Logs
    new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
            winston.format.json()
        )
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

module.exports = logger;
