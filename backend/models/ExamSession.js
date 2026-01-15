const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['TAB_SWITCH', 'MULTIPLE_FACES', 'NO_FACE', 'COPY_PASTE', 'RIGHT_CLICK', 'AUDIO_DETECTED'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    snapshotUrl: String // URL to webcam snapshot evidence
});

const examSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    examId: {
        type: String, // Could be linked to a Course/Exam model in future
        required: true,
        index: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date,
    status: {
        type: String,
        enum: ['active', 'completed', 'terminated'],
        default: 'active'
    },
    violations: [violationSchema],
    integrityScore: {
        type: Number,
        default: 100
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
