import { Queue } from 'bullmq';
import { getBullMqConnection } from '../../config/redis.connection.js';
import { logger } from '../../config/logger.config.js';
import { shouldDispatchQueueJobs } from '../../config/job-processing.js';

export type ResendEmailFetchJob = {
  emailId: string;
  inboundEventId: number;
  correlationId: string;
  webhookId: string;
};

let queue: Queue<ResendEmailFetchJob, void, 'fetch-resend-email'> | null = null;

const getQueue = () => {
  if (!queue) {
    queue = new Queue('resend-email-fetch-queue', { connection: getBullMqConnection() });
  }
  return queue;
};

export const enqueueResendEmailFetch = async (data: ResendEmailFetchJob): Promise<void> => {
  if (!shouldDispatchQueueJobs()) {
    return;
  }

  await getQueue().add('fetch-resend-email', data, {
    jobId: data.webhookId,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 50,
    removeOnFail: 100
  });
};

export const startResendEmailFetchWorker = async (): Promise<void> => {
  const { Worker } = await import('bullmq');
  const { processResendEmailFetch } = await import('./resend.fetch.processor.js');

  const worker = new Worker<ResendEmailFetchJob, void, 'fetch-resend-email'>(
    'resend-email-fetch-queue',
    async (job) => {
      await processResendEmailFetch(job.data);
    },
    { connection: getBullMqConnection(), concurrency: 2 }
  );

  worker.on('error', (error) => {
    logger.error('[resend-worker] connection error', { message: error.message });
  });
};
