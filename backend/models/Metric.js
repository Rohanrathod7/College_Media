const mongoose = require('mongoose');

/**
 * Metric Model - Stores time-series data for platform analytics
 */
const metricSchema = new mongoose.Schema({
    // Date for aggregation (normalized to start of day)
    date: {
        type: Date,
        required: true,
        index: true
    },
    // Metric type for querying specific data
    type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'system'],
        default: 'daily',
        index: true
    },

    // User Metrics
    users: {
        total: { type: Number, default: 0 },
        newToday: { type: Number, default: 0 },
        activeToday: { type: Number, default: 0 },
        activeLast7Days: { type: Number, default: 0 },
        activeLast30Days: { type: Number, default: 0 }
    },

    // Content Metrics
    posts: {
        total: { type: Number, default: 0 },
        newToday: { type: Number, default: 0 },
        likesToday: { type: Number, default: 0 },
        commentsToday: { type: Number, default: 0 }
    },

    // Message Metrics
    messages: {
        total: { type: Number, default: 0 },
        sentToday: { type: Number, default: 0 }
    },

    // Engagement Metrics
    engagement: {
        avgPostsPerUser: { type: Number, default: 0 },
        avgSessionDuration: { type: Number, default: 0 }, // in minutes
        retentionRate: { type: Number, default: 0 } // percentage
    },

    // System Health (for system type metrics)
    system: {
        cpuUsage: { type: Number, default: 0 }, // percentage
        memoryUsage: { type: Number, default: 0 }, // percentage
        dbLatency: { type: Number, default: 0 }, // ms
        apiResponseTime: { type: Number, default: 0 }, // ms avg
        errorRate: { type: Number, default: 0 } // percentage
    }
}, {
    timestamps: true
});

// Compound index for efficient date-range queries
metricSchema.index({ date: 1, type: 1 });

// Static method to get metrics in date range
metricSchema.statics.getInRange = async function (startDate, endDate, type = 'daily') {
    return this.find({
        date: { $gte: startDate, $lte: endDate },
        type
    }).sort({ date: 1 });
};

// Static method to get latest metrics
metricSchema.statics.getLatest = async function (type = 'daily') {
    return this.findOne({ type }).sort({ date: -1 });
};

module.exports = mongoose.model('Metric', metricSchema);
