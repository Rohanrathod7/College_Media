import * as blazeface from '@tensorflow-models/blazeface'; // Requires install
import * as tf from '@tensorflow/tfjs-core'; // Requires install
import axios from 'axios';

class ProctorAI {
    constructor() {
        this.model = null;
        this.stream = null;
        this.videoElement = null;
        this.sessionId = null;
        this.intervalId = null;
        this.isMonitoring = false;
        this.token = null;
    }

    async init(sessionId, token, videoElement) {
        this.sessionId = sessionId;
        this.token = token;
        this.videoElement = videoElement;

        // Load Blazeface model
        try {
            console.log("Loading ProctorAI models...");
            await tf.setBackend('webgl');
            this.model = await blazeface.load();
            console.log("ProctorAI models loaded.");
        } catch (error) {
            console.error("Failed to load AI models:", error);
            // Fallback or alert user
        }

        // Access Webcam
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
            }
        } catch (error) {
            this.reportViolation('NO_FACE', { message: 'Camera access denied' });
        }
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        // 1. Face Detection Loop
        if (this.model && this.videoElement) {
            this.intervalId = setInterval(() => this.detectFaces(), 3000); // Check every 3s
        }

        // 2. Tab Switching (Visibility API)
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // 3. Blur/Focus (Window)
        window.addEventListener('blur', this.handleWindowBlur);

        // 4. Disable Context Menu & Copy/Paste
        document.addEventListener('contextmenu', this.preventEvent);
        document.addEventListener('copy', this.preventEvent);
        document.addEventListener('paste', this.preventEvent);
    }

    stopMonitoring() {
        this.isMonitoring = false;
        if (this.intervalId) clearInterval(this.intervalId);

        // Remove listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('blur', this.handleWindowBlur);
        document.removeEventListener('contextmenu', this.preventEvent);
        document.removeEventListener('copy', this.preventEvent);
        document.removeEventListener('paste', this.preventEvent);

        // Stop Camera
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }

    // --- Violation Handlers ---

    handleVisibilityChange = () => {
        if (document.hidden) {
            this.reportViolation('TAB_SWITCH', { message: 'User switched tab' });
        }
    };

    handleWindowBlur = () => {
        this.reportViolation('TAB_SWITCH', { message: 'Window lost focus' });
    };

    preventEvent = (e) => {
        e.preventDefault();
        let type = 'RIGHT_CLICK';
        if (e.type === 'copy' || e.type === 'paste') type = 'COPY_PASTE';

        this.reportViolation(type, { event: e.type });
        alert(`Action ${e.type} is disabled during the exam.`);
    };

    async detectFaces() {
        if (!this.model || !this.videoElement) return;

        try {
            const predictions = await this.model.estimateFaces(this.videoElement, false);

            if (predictions.length === 0) {
                this.reportViolation('NO_FACE', { message: 'No face detected' });
            } else if (predictions.length > 1) {
                this.reportViolation('MULTIPLE_FACES', { message: `${predictions.length} faces detected` });
            }
            // 1 Face is Good
        } catch (error) {
            console.error('ProctorAI Detection Error:', error);
        }
    }

    async reportViolation(type, details) {
        if (!this.isMonitoring) return;

        console.warn(`[ProctorAI] Violation: ${type}`, details);

        try {
            // Take snapshot
            const snapshot = this.captureSnapshot();

            const response = await axios.post('http://localhost:5000/api/proctoring/violation', {
                sessionId: this.sessionId,
                type,
                details,
                snapshotUrl: snapshot // In prod, upload to S3 first and send URL
            }, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            if (response.data.terminated) {
                alert('Exam Terminated by Proctor due to suspicious activity.');
                this.stopMonitoring();
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.error('Failed to report violation:', error);
        }
    }

    captureSnapshot() {
        if (!this.videoElement) return null;
        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        canvas.getContext('2d').drawImage(this.videoElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.5);
    }
}

export default new ProctorAI();
