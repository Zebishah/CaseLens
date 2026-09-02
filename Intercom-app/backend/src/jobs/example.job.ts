import { Worker } from 'bullmq';
import { getBullMqConnection } from '../config/redis.connection.js';
import { logger } from '../config/logger.config.js';
import type { ExampleJobData } from '../queues/example.queue.js';

export const startExampleWorker = (): Worker<ExampleJobData, void, 'log-example'> => {
  const worker = new Worker<ExampleJobData, void, 'log-example'>(
    'example-queue',
    async (job) => {
      logger.info(`Processed example job: ${job.data.message}`);
    },
    { connection: getBullMqConnection() }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] Example job failed', {
      jobId: job?.id,
      error: error.message
    });
  });

  worker.on('error', (error) => {
    logger.error('[worker] Example worker connection error', {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code
    });
  });

  return worker;
};
