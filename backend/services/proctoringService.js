const ExamSession = require('../models/ExamSession');
const logger = require('../utils/logger');

// Penalty weights for different violations
const VIOLATION_WEIGHTS = {
    TAB_SWITCH: 5,
    NO_FACE: 10,
    MULTIPLE_FACES: 20,
    COPY_PASTE: 5,
    RIGHT_CLICK: 2,
    AUDIO_DETECTED: 15
};

class ProctoringService {

    /**
     * Start a new exam session
     */
    static async startSession(userId, examId) {
        return await ExamSession.create({
            user: userId,
            examId,
            status: 'active'
        });
    }

    /**
     * Log a violation
     */
    static async logViolation(sessionId, type, details, snapshotUrl) {
        try {
            const session = await ExamSession.findById(sessionId);
            if (!session || session.status !== 'active') {
                throw new Error('Session inactive or not found');
            }

            session.violations.push({
                type,
                details,
                snapshotUrl,
                timestamp: new Date()
            });

            // Update Integrity Score
            const penalty = VIOLATION_WEIGHTS[type] || 5;
            session.integrityScore = Math.max(0, session.integrityScore - penalty);

            // Auto-terminate if score drops too low
            if (session.integrityScore < 50) {
                session.status = 'terminated';
                logger.warn(`Exam session ${sessionId} terminated due to low integrity.`);
            }

            await session.save();
            return session;
        } catch (error) {
            logger.error('Log violation error:', error);
            throw error;
        }
    }

    /**
     * End session and generate report
     */
    static async endSession(sessionId) {
        const session = await ExamSession.findByIdAndUpdate(sessionId, {
            status: 'completed',
            endTime: new Date()
        }, { new: true });

        return session;
    }

    /**
     * Generate Integrity Report
     */
    static async getReport(sessionId) {
        const session = await ExamSession.findById(sessionId).populate('user', 'username email');
        if (!session) throw new Error('Session not found');

        const report = {
            candidate: session.user.username,
            examId: session.examId,
            score: session.integrityScore,
            status: session.status,
            durationMinutes: (new Date(session.endTime || Date.now()) - session.startTime) / 60000,
            violationsCount: session.violations.length,
            violationBreakdown: {},
            timeline: session.violations
        };

        // Group violations
        session.violations.forEach(v => {
            report.violationBreakdown[v.type] = (report.violationBreakdown[v.type] || 0) + 1;
        });

        return report;
    }
}

module.exports = ProctoringService;
