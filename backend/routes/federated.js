const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/authMiddleware');

const FEDERATED_SERVICE_URL = process.env.FEDERATED_SERVICE_URL || 'http://localhost:6000';

/**
 * @route GET /api/federated/model
 * @desc Get the current global model weights
 * @access Private (Registered users participate)
 */
router.get('/model', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(`${FEDERATED_SERVICE_URL}/api/model`);
        res.json(response.data);
    } catch (error) {
        logger.error('Federated Proxy Error:', error.message);
        res.status(502).json({
            success: false,
            message: 'Federated Learning Coordinator Unavailable'
        });
    }
});

/**
 * @route POST /api/federated/train
 * @desc Submit local model gradients/updates
 * @access Private
 */
router.post('/train', verifyToken, async (req, res) => {
    try {
        // Forward update to Python Service
        // We could validate structure here to protect the service
        const response = await axios.post(`${FEDERATED_SERVICE_URL}/api/train`, req.body);
        res.json(response.data);
    } catch (error) {
        logger.error('Federated Update Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to submit Model Update'
        });
    }
});

module.exports = router;
