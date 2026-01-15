const express = require('express');
const router = express.Router();
const ProctoringService = require('../services/proctoringService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

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
 * /api/proctoring/start:
 *   post:
 *     summary: Start exam proctoring session
 */
router.post('/start', verifyToken, async (req, res) => {
    try {
        const { examId } = req.body;
        const session = await ProctoringService.startSession(req.userId, examId);
        res.json({ success: true, sessionId: session._id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /api/proctoring/violation:
 *   post:
 *     summary: Log proctoring violation
 */
router.post('/violation', verifyToken, async (req, res) => {
    try {
        const { sessionId, type, details, snapshotUrl } = req.body;
        const session = await ProctoringService.logViolation(sessionId, type, details, snapshotUrl);

        if (session.status === 'terminated') {
            return res.status(403).json({ success: false, terminated: true, message: 'Exam terminated due to cheating.' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /api/proctoring/end:
 *   post:
 *     summary: End proctoring session
 */
router.post('/end', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await ProctoringService.endSession(sessionId);
        const report = await ProctoringService.getReport(sessionId);
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
