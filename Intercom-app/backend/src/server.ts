import { app } from './app.js';
import { env } from './config/env.config.js';
import { logger } from './config/logger.config.js';
import { pool } from './database/connection.js';
import { ensureRequiredApplicationSchema } from './database/startup-schema.js';
import { closeSharedRedis } from './config/redis.config.js';
import { shouldStartQueueWorkers } from './config/job-processing.js';
import { ingestionService } from './modules/ingestion/ingestion.service.js';
import { demoSessionService } from './modules/demo/demo-session.service.js';
import { operationalMetrics } from './observability/metrics.js';

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const code =
    reason instanceof Error ? (reason as NodeJS.ErrnoException).code : undefined;

  logger.error('[process] Unhandled promise rejection', { message, code });
});

process.on('uncaughtException', (error) => {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EIO' || /EIO:\s*i\/o error,\s*write/i.test(error.message)) {
    return;
  }

  logger.error('[process] Uncaught exception', {
    message: error.message,
    code,
    stack: error.stack
  });
});

const startWorkers = async (): Promise<void> => {
  const { startIntercomIntelligenceWorker } = await import('./jobs/intercom-intelligence.job.js');
  const { startStoreDirectorySyncWorker } = await import('./jobs/store-directory-sync.job.js');
  startIntercomIntelligenceWorker();
  startStoreDirectorySyncWorker();
  if (env.RESEND_ENABLED) {
    const { startResendEmailFetchWorker } = await import('./modules/resend/resend.queue.js');
    await startResendEmailFetchWorker();
  }

  const recover = async (): Promise<void> => {
    try {
      const recovered = await ingestionService.recoverPendingOutbox();
      operationalMetrics.outboxRecovered(recovered);
      if (recovered > 0) {
        logger.info('[startup] Recovered pending outbox records', { recovered });
      }
    } catch (error) {
      logger.error('[startup] Outbox recovery failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  await recover();
  setInterval(() => {
    void recover();
  }, 60_000).unref();
};

let server: ReturnType<typeof app.listen> | null = null;

const startApplication = async (): Promise<void> => {
  await ensureRequiredApplicationSchema();

  server = env.RUN_API
    ? app.listen(env.PORT, () => {
        logger.info(`Server running on port ${env.PORT}`, {
          runApi: env.RUN_API,
          runWorkers: env.RUN_WORKERS,
          jobProcessingMode: env.JOB_PROCESSING_MODE
        });
      })
    : null;

  if (shouldStartQueueWorkers()) {
    await startWorkers();
  }
};

void startApplication().catch(async (error: unknown) => {
  logger.error('[startup] Application startup failed', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});

if (env.NODE_ENV !== 'test') {
  setInterval(() => {
    void demoSessionService.purgeExpired().catch((error: unknown) => {
      logger.error('[startup] Demo session purge failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }, 60 * 60 * 1000).unref();
}

const shutdown = async (signal: string): Promise<void> => {
  logger.info('[process] Graceful shutdown started', { signal });
  server?.close();
  await Promise.allSettled([pool.end(), closeSharedRedis()]);
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
