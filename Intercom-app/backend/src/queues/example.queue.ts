import { Queue } from 'bullmq';
import { getBullMqConnection } from '../config/redis.connection.js';
import { shouldDispatchQueueJobs } from '../config/job-processing.js';
import { logger } from '../config/logger.config.js';

export type ExampleJobData = {
  message: string;
};

let exampleQueue: Queue<ExampleJobData, void, 'log-example'> | null = null;

const getExampleQueue = (): Queue<ExampleJobData, void, 'log-example'> => {
  if (!exampleQueue) {
    exampleQueue = new Queue<ExampleJobData, void, 'log-example'>('example-queue', {
      connection: getBullMqConnection()
    });

    exampleQueue.on('error', (error) => {
      logger.error('[queue] Example queue connection error', {
        message: error.message,
        code: (error as NodeJS.ErrnoException).code
      });
    });
  }

  return exampleQueue;
};

export const addExampleJob = async (data: ExampleJobData): Promise<void> => {
  if (!shouldDispatchQueueJobs()) {
    return;
  }

  await getExampleQueue().add('log-example', data);
};
