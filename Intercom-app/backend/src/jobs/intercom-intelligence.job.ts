import { UnrecoverableError, Worker } from 'bullmq';
import { getBullMqConnection } from '../config/redis.connection.js';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import { classifyProcessingError } from '../modules/ingestion/error-classification.js';
import type { IntercomIntelligenceJobData } from '../queues/intercom-intelligence.queue.js';
import { handleIntelligenceJob } from './intelligence-job.handler.js';

let worker: Worker<IntercomIntelligenceJobData, void, 'process-intelligence'> | null = null;

export const startIntercomIntelligenceWorker = (): Worker<
  IntercomIntelligenceJobData,
  void,
  'process-intelligence'
> => {
  if (worker) {
    return worker;
  }

  worker = new Worker<IntercomIntelligenceJobData, void, 'process-intelligence'>(
    'intercom-intelligence-queue',
    async (job) => {
      logger.info('[worker] Job picked up from queue', {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        conversationId: job.data.conversationId,
        intercomId: job.data.intercomId
      });

      try {
        await handleIntelligenceJob(job.data);
      } catch (error) {
        const classified = classifyProcessingError(error);
        logger.error('[worker] Intelligence job error', {
          jobId: job.id,
          conversationId: job.data.conversationId,
          code: classified.code,
          retryable: classified.retryable
        });
        if (!classified.retryable) {
          throw new UnrecoverableError(classified.safeMessage);
        }
        throw error;
      }
    },
    {
      connection: getBullMqConnection(),
      concurrency: env.INTELLIGENCE_WORKER_CONCURRENCY
    }
  );

  worker.on('failed', (job, error) => {
    logger.error('Intercom intelligence job failed', {
      conversationId: job?.data.conversationId,
      intercomId: job?.data.intercomId,
      peerSnapshotRefresh: Boolean(job?.data.peerSnapshotRefresh),
      error: error.message
    });
  });

  worker.on('error', (error) => {
    logger.error('[worker] Intelligence worker connection error', {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code
    });
  });

  logger.info('[worker] Intelligence worker started', {
    concurrency: env.INTELLIGENCE_WORKER_CONCURRENCY
  });

  return worker;
};
