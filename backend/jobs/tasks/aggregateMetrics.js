const AnalyticsService = require('../../services/analyticsService');
const logger = require('../../utils/logger');

/**
 * Task: Aggregate daily metrics for analytics dashboard
 * Runs: Every day at midnight
 */
module.exports = {
    name: 'aggregateMetrics',
    schedule: '0 0 * * *', // Daily at midnight
    enabled: true,
    description: 'Calculate and store daily platform metrics for analytics dashboard',

    async execute() {
        const startTime = Date.now();
        logger.info('Starting metrics aggregation task...');

        try {
            const metric = await AnalyticsService.calculateDailyMetrics();

            const duration = Date.now() - startTime;
            logger.info(`Metrics aggregation completed in ${duration}ms`);

            return {
                success: true,
                metric: {
                    date: metric.date,
                    users: metric.users.total,
                    posts: metric.posts.total,
                    activeUsers: metric.users.activeToday
                },
                duration
            };
        } catch (error) {
            logger.error('Metrics aggregation task failed:', error);
            throw error;
        }
    }
};
