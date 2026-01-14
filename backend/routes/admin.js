const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const scheduler = require('../jobs/scheduler');
const { checkPermission, PERMISSIONS } = require('../middleware/rbacMiddleware');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

/**
 * @swagger
 * /api/admin/tasks:
 *   get:
 *     summary: Get all scheduled tasks status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tasks', verifyToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const status = scheduler.getStatus();
        res.json({
            success: true,
            data: status,
            message: 'Task status retrieved'
        });
    } catch (error) {
        logger.error('Get tasks error:', error);
        res.status(500).json({ success: false, message: 'Failed to get tasks' });
    }
});

/**
 * @swagger
 * /api/admin/tasks/{name}/trigger:
 *   post:
 *     summary: Manually trigger a task
 *     tags: [Admin]
 */
router.post('/tasks/:name/trigger', verifyToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
    try {
        const { name } = req.params;
        const result = await scheduler.trigger(name);

        res.json({
            success: true,
            data: result,
            message: `Task ${name} triggered successfully`
        });
    } catch (error) {
        logger.error('Trigger task error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /api/admin/tasks/{name}/enable:
 *   post:
 *     summary: Enable a scheduled task
 *     tags: [Admin]
 */
router.post('/tasks/:name/enable', verifyToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const task = scheduler.enable(req.params.name);
        res.json({
            success: true,
            data: { name: task.name, enabled: task.enabled },
            message: `Task ${req.params.name} enabled`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /api/admin/tasks/{name}/disable:
 *   post:
 *     summary: Disable a scheduled task
 *     tags: [Admin]
 */
router.post('/tasks/:name/disable', verifyToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const task = scheduler.disable(req.params.name);
        res.json({
            success: true,
            data: { name: task.name, enabled: task.enabled },
            message: `Task ${req.params.name} disabled`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// ============== ANALYTICS ENDPOINTS ==============
const AnalyticsService = require('../services/analyticsService');

/**
 * @swagger
 * /api/admin/analytics/dashboard:
 *   get:
 *     summary: Get dashboard overview with key metrics
 *     tags: [Admin]
 */
router.get('/analytics/dashboard', verifyToken, checkPermission(PERMISSIONS.VIEW_LOGS), async (req, res) => {
    try {
        const overview = await AnalyticsService.getDashboardOverview();
        res.json({
            success: true,
            data: overview,
            message: 'Dashboard overview retrieved'
        });
    } catch (error) {
        logger.error('Get dashboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to get dashboard' });
    }
});

/**
 * @swagger
 * /api/admin/analytics/metrics:
 *   get:
 *     summary: Get metrics for a date range
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 */
router.get('/analytics/metrics', verifyToken, checkPermission(PERMISSIONS.VIEW_LOGS), async (req, res) => {
    try {
        const { startDate, endDate, granularity = 'daily' } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        const result = await AnalyticsService.getMetrics(start, end, granularity);
        res.json({
            success: true,
            data: result,
            message: 'Metrics retrieved'
        });
    } catch (error) {
        logger.error('Get metrics error:', error);
        res.status(500).json({ success: false, message: 'Failed to get metrics' });
    }
});

/**
 * @swagger
 * /api/admin/analytics/health:
 *   get:
 *     summary: Get real-time system health metrics
 *     tags: [Admin]
 */
router.get('/analytics/health', verifyToken, checkPermission(PERMISSIONS.VIEW_LOGS), async (req, res) => {
    try {
        const health = await AnalyticsService.getSystemHealth();
        res.json({
            success: true,
            data: health,
            message: 'System health retrieved'
        });
    } catch (error) {
        logger.error('Get health error:', error);
        res.status(500).json({ success: false, message: 'Failed to get health' });
    }
});

/**
 * @swagger
 * /api/admin/analytics/refresh:
 *   post:
 *     summary: Manually trigger metrics calculation
 *     tags: [Admin]
 */
router.post('/analytics/refresh', verifyToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
    try {
        const metric = await AnalyticsService.calculateDailyMetrics();
        res.json({
            success: true,
            data: metric,
            message: 'Metrics refreshed successfully'
        });
    } catch (error) {
        logger.error('Refresh metrics error:', error);
        res.status(500).json({ success: false, message: 'Failed to refresh metrics' });
    }
});

module.exports = router;
