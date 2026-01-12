/**
 * ==================================================
 * JobRunner – Safe Background Job Executor
 * Retry | Backoff | Timeout | DLQ | Logging
 * ==================================================
 */

class JobRunner {
  constructor({
    jobName,
    handler,
    maxRetries = 3,
    backoffMs = 2000,
    timeoutMs = 5000,
  }) {
    this.jobName = jobName;
    this.handler = handler;
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
    this.timeoutMs = timeoutMs;
  }

  async run(payload = {}) {
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;

      try {
        console.log(
          `[JOB START] ${this.jobName} | Attempt ${attempt}`
        );

        const result = await this._runWithTimeout(
          this.handler(payload),
          this.timeoutMs
        );

        console.log(
          `[JOB SUCCESS] ${this.jobName} | Attempt ${attempt}`
        );

        return result;
      } catch (error) {
        console.error(
          `[JOB FAILED] ${this.jobName} | Attempt ${attempt}`,
          {
            error: error.message,
            payload,
          }
        );

        if (attempt > this.maxRetries) {
          await this._moveToDeadLetterQueue(error, payload);
          throw error;
        }

        await this._backoff(attempt);
      }
    }
  }

  async _runWithTimeout(promise, timeoutMs) {
    let timeout;

    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Job execution timed out"));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() =>
      clearTimeout(timeout)
    );
  }

  async _backoff(attempt) {
    const delay = this.backoffMs * attempt;
    console.log(
      `[JOB RETRY] ${this.jobName} | Retrying in ${delay}ms`
    );

    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  async _moveToDeadLetterQueue(error, payload) {
    console.error(
      `[JOB DEAD LETTER] ${this.jobName}`,
      {
        reason: error.message,
        payload,
        timestamp: new Date().toISOString(),
      }
    );

    /**
     * 👉 Future-ready:
     * - Save to DB
     * - Push to DLQ queue
     * - Send alert (Slack / Email)
     */
  }
}

module.exports = JobRunner;
