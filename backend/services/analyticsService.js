const os = require('os');
const Metric = require('../models/Metric');
const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const logger = require('../utils/logger');

/**
 * Analytics Service - Handles data aggregation and metrics calculation
 */
class AnalyticsService {
    /**
     * Get real-time system health metrics
     */
    static async getSystemHealth() {
        const startTime = Date.now();

        // CPU Usage
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        // Memory Usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

        // DB Latency (simple ping)
        let dbLatency = 0;
        try {
            const dbStart = Date.now();
            await User.findOne().limit(1);
            dbLatency = Date.now() - dbStart;
        } catch (err) {
            dbLatency = -1; // Error indicator
        }

        return {
            cpuUsage: Math.round(cpuUsage * 100) / 100,
            memoryUsage: Math.round(memoryUsage * 100) / 100,
            totalMemory: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100, // GB
            freeMemory: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100, // GB
            dbLatency,
            uptime: Math.round(os.uptime() / 3600), // hours
            platform: os.platform(),
            nodeVersion: process.version
        };
    }

    /**
     * Calculate daily metrics and store in database
     */
    static async calculateDailyMetrics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            // User metrics
            const [totalUsers, newUsers, activeToday, active7Days, active30Days] = await Promise.all([
                User.countDocuments({ isDeleted: false }),
                User.countDocuments({ createdAt: { $gte: today }, isDeleted: false }),
                User.countDocuments({ lastLogin: { $gte: today }, isDeleted: false }),
                User.countDocuments({ lastLogin: { $gte: sevenDaysAgo }, isDeleted: false }),
                User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo }, isDeleted: false })
            ]);

            // Post metrics
            const [totalPosts, newPosts] = await Promise.all([
                Post.countDocuments({ isDeleted: false }),
                Post.countDocuments({ createdAt: { $gte: today }, isDeleted: false })
            ]);

            // Message metrics
            const [totalMessages, newMessages] = await Promise.all([
                Message.countDocuments(),
                Message.countDocuments({ createdAt: { $gte: today } })
            ]);

            // Calculate engagement
            const avgPostsPerUser = totalUsers > 0 ? totalPosts / totalUsers : 0;
            const retentionRate = totalUsers > 0 ? (active7Days / totalUsers) * 100 : 0;

            // System health
            const systemHealth = await this.getSystemHealth();

            // Create or update today's metric
            const metric = await Metric.findOneAndUpdate(
                { date: today, type: 'daily' },
                {
                    date: today,
                    type: 'daily',
                    users: {
                        total: totalUsers,
                        newToday: newUsers,
                        activeToday,
                        activeLast7Days: active7Days,
                        activeLast30Days: active30Days
                    },
                    posts: {
                        total: totalPosts,
                        newToday: newPosts
                    },
                    messages: {
                        total: totalMessages,
                        sentToday: newMessages
                    },
                    engagement: {
                        avgPostsPerUser: Math.round(avgPostsPerUser * 100) / 100,
                        retentionRate: Math.round(retentionRate * 100) / 100
                    },
                    system: {
                        cpuUsage: systemHealth.cpuUsage,
                        memoryUsage: systemHealth.memoryUsage,
                        dbLatency: systemHealth.dbLatency
                    }
                },
                { upsert: true, new: true }
            );

            logger.info('Daily metrics calculated and saved');
            return metric;
        } catch (error) {
            logger.error('Calculate daily metrics error:', error);
            throw error;
        }
    }

    /**
     * Get metrics for a date range
     */
    static async getMetrics(startDate, endDate, granularity = 'daily') {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const metrics = await Metric.getInRange(start, end, granularity);

            return {
                metrics,
                summary: this.calculateSummary(metrics)
            };
        } catch (error) {
            logger.error('Get metrics error:', error);
            throw error;
        }
    }

    /**
     * Calculate summary statistics from metrics array
     */
    static calculateSummary(metrics) {
        if (!metrics.length) return null;

        const latest = metrics[metrics.length - 1];
        const first = metrics[0];

        return {
            period: {
                start: first.date,
                end: latest.date,
                days: metrics.length
            },
            growth: {
                users: latest.users.total - first.users.total,
                posts: latest.posts.total - first.posts.total,
                messages: latest.messages.total - first.messages.total
            },
            averages: {
                dailyNewUsers: Math.round(metrics.reduce((sum, m) => sum + m.users.newToday, 0) / metrics.length * 100) / 100,
                dailyNewPosts: Math.round(metrics.reduce((sum, m) => sum + m.posts.newToday, 0) / metrics.length * 100) / 100,
                avgEngagement: Math.round(metrics.reduce((sum, m) => sum + m.engagement.retentionRate, 0) / metrics.length * 100) / 100
            },
            current: {
                totalUsers: latest.users.total,
                activeUsers: latest.users.activeLast7Days,
                totalPosts: latest.posts.total
            }
        };
    }

    /**
     * Get dashboard overview (quick stats)
     */
    static async getDashboardOverview() {
        try {
            const [latestMetric, systemHealth] = await Promise.all([
                Metric.getLatest('daily'),
                this.getSystemHealth()
            ]);

            // If no metrics exist yet, calculate them now
            if (!latestMetric) {
                return {
                    message: 'No metrics available yet. Run the aggregation job first.',
                    systemHealth
                };
            }

            return {
                users: latestMetric.users,
                posts: latestMetric.posts,
                messages: latestMetric.messages,
                engagement: latestMetric.engagement,
                systemHealth,
                lastUpdated: latestMetric.updatedAt
            };
        } catch (error) {
            logger.error('Get dashboard overview error:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsService;
