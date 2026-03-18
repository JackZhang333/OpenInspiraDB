import { JOB_STATUS, IMAGE_STATUS, RETRY_BACKOFF_MS, QUEUE_CONCURRENCY, JOB_TIMEOUT_MS } from '../core/config.js';
import { nowIso } from '../core/database.js';

function runWithTimeout(taskPromise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('JOB_TIMEOUT');
      error.code = 'JOB_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([taskPromise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export class AnalysisQueue {
  constructor({
    db,
    aiService,
    logger,
    concurrency = QUEUE_CONCURRENCY,
    timeoutMs = JOB_TIMEOUT_MS,
    tickMs = 500,
  }) {
    this.db = db;
    this.aiService = aiService;
    this.logger = logger;
    this.concurrency = concurrency;
    this.timeoutMs = timeoutMs;
    this.tickMs = tickMs;

    this.running = false;
    this.activeJobIds = new Set();
    this.retryTimers = new Map();
    this.intervalRef = null;
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.recoverJobs();
    this.intervalRef = setInterval(() => {
      this.drain().catch((error) => {
        this.logger.error('queue-drain-failed', { error: String(error?.message || error) });
      });
    }, this.tickMs);

    this.logger.info('analysis-queue-started');
  }

  stop() {
    this.running = false;
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    this.activeJobIds.clear();
    this.logger.info('analysis-queue-stopped');
  }

  recoverJobs() {
    this.db.transaction(() => {
      const now = nowIso();
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :pending,
             updated_at = :updatedAt
         WHERE status IN (:processing, :retrying)`,
        {
          pending: JOB_STATUS.PENDING,
          processing: JOB_STATUS.PROCESSING,
          retrying: JOB_STATUS.RETRYING,
          updatedAt: now,
        },
      );

      this.db.run(
        `UPDATE images
         SET analysis_status = :queued,
             updated_at = :updatedAt
         WHERE id IN (
           SELECT image_id
           FROM analysis_jobs
           WHERE status = :pending
         )
         AND analysis_status != :ready`,
        {
          queued: IMAGE_STATUS.QUEUED,
          ready: IMAGE_STATUS.READY,
          pending: JOB_STATUS.PENDING,
          updatedAt: now,
        },
      );
    });
  }

  async drain() {
    if (!this.running) {
      return;
    }

    const slots = this.concurrency - this.activeJobIds.size;
    if (slots <= 0) {
      return;
    }

    const jobs = this.db.all(
      `SELECT *
       FROM analysis_jobs
       WHERE status = :pending
       ORDER BY created_at ASC
       LIMIT :limit`,
      {
        pending: JOB_STATUS.PENDING,
        limit: slots,
      },
    );

    for (const job of jobs) {
      if (this.activeJobIds.has(job.id)) {
        continue;
      }
      this.processJob(job).catch((error) => {
        this.logger.error('job-process-unhandled-error', {
          jobId: job.id,
          error: String(error?.message || error),
        });
      });
    }
  }

  async processJob(job) {
    this.activeJobIds.add(job.id);

    const startTs = nowIso();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :processing,
             started_at = :startedAt,
             updated_at = :updatedAt
         WHERE id = :jobId`,
        {
          processing: JOB_STATUS.PROCESSING,
          startedAt: startTs,
          updatedAt: startTs,
          jobId: job.id,
        },
      );

      if (job.job_type === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :analyzing,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            analyzing: IMAGE_STATUS.ANALYZING,
            updatedAt: startTs,
            imageId: job.image_id,
          },
        );
      }
    });

    try {
      await runWithTimeout(this.executeJob(job), this.timeoutMs);
      this.markJobSucceeded(job);
    } catch (error) {
      this.markJobFailure(job, error);
    } finally {
      this.activeJobIds.delete(job.id);
    }
  }

  async executeJob(job) {
    if (job.job_type === 'refresh_embedding') {
      await this.aiService.refreshEmbedding(job.image_id);
      return;
    }

    await this.aiService.analyzeImage(job.image_id);
  }

  markJobSucceeded(job) {
    const now = nowIso();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :succeeded,
             finished_at = :finishedAt,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = :updatedAt
         WHERE id = :jobId`,
        {
          succeeded: JOB_STATUS.SUCCEEDED,
          finishedAt: now,
          updatedAt: now,
          jobId: job.id,
        },
      );

      if (job.job_type === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :ready,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            ready: IMAGE_STATUS.READY,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }

      if (job.job_type === 'refresh_embedding') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :ready,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            ready: IMAGE_STATUS.READY,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }
    });

    this.logger.info('job-succeeded', { jobId: job.id, imageId: job.image_id, jobType: job.job_type });
  }

  markJobFailure(job, error) {
    const retryCount = Number(job.retry_count) + 1;
    const maxRetry = Number(job.max_retry_count);
    const now = nowIso();
    const errorCode = error?.code || 'UNKNOWN_ERROR';
    const errorMessage = String(error?.message || error || 'unknown');

    if (retryCount <= maxRetry) {
      this.db.transaction(() => {
        this.db.run(
          `UPDATE analysis_jobs
           SET status = :retrying,
               retry_count = :retryCount,
               last_error_code = :errorCode,
               last_error_message = :errorMessage,
               updated_at = :updatedAt
           WHERE id = :jobId`,
          {
            retrying: JOB_STATUS.RETRYING,
            retryCount,
            errorCode,
            errorMessage,
            updatedAt: now,
            jobId: job.id,
          },
        );

        if (job.job_type === 'analyze_image') {
          this.db.run(
            `UPDATE images
             SET analysis_status = :failed,
                 updated_at = :updatedAt
             WHERE id = :imageId`,
            {
              failed: IMAGE_STATUS.FAILED,
              updatedAt: now,
              imageId: job.image_id,
            },
          );
        }
      });

      const backoffMs = RETRY_BACKOFF_MS[Math.min(retryCount - 1, RETRY_BACKOFF_MS.length - 1)];
      const timer = setTimeout(() => {
        this.db.transaction(() => {
          const ts = nowIso();
          this.db.run(
            `UPDATE analysis_jobs
             SET status = :pending,
                 updated_at = :updatedAt
             WHERE id = :jobId`,
            {
              pending: JOB_STATUS.PENDING,
              updatedAt: ts,
              jobId: job.id,
            },
          );

          if (job.job_type === 'analyze_image') {
            this.db.run(
              `UPDATE images
               SET analysis_status = :queued,
                   updated_at = :updatedAt
               WHERE id = :imageId`,
              {
                queued: IMAGE_STATUS.QUEUED,
                updatedAt: ts,
                imageId: job.image_id,
              },
            );
          }
        });

        this.retryTimers.delete(job.id);
      }, backoffMs);

      this.retryTimers.set(job.id, timer);
      this.logger.error('job-failed-will-retry', {
        jobId: job.id,
        imageId: job.image_id,
        retryCount,
        maxRetry,
        backoffMs,
        errorCode,
        errorMessage,
      });
      return;
    }

    this.db.transaction(() => {
      this.db.run(
        `UPDATE analysis_jobs
         SET status = :failed,
             retry_count = :retryCount,
             last_error_code = :errorCode,
             last_error_message = :errorMessage,
             finished_at = :finishedAt,
             updated_at = :updatedAt
         WHERE id = :jobId`,
        {
          failed: JOB_STATUS.FAILED,
          retryCount,
          errorCode,
          errorMessage,
          finishedAt: now,
          updatedAt: now,
          jobId: job.id,
        },
      );

      if (job.job_type === 'analyze_image') {
        this.db.run(
          `UPDATE images
           SET analysis_status = :failed,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            failed: IMAGE_STATUS.FAILED,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }

      if (job.job_type === 'refresh_embedding') {
        this.db.run(
          `UPDATE images
           SET needs_embedding_refresh = 1,
               analysis_status = :failed,
               updated_at = :updatedAt
           WHERE id = :imageId`,
          {
            failed: IMAGE_STATUS.FAILED,
            updatedAt: now,
            imageId: job.image_id,
          },
        );
      }
    });

    this.logger.error('job-failed-final', {
      jobId: job.id,
      imageId: job.image_id,
      errorCode,
      errorMessage,
      retryCount,
    });
  }
}
