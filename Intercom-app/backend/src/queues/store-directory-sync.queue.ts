import { Queue } from 'bullmq';
import { getBullMqConnection } from '../config/redis.connection.js';
import { logger } from '../config/logger.config.js';
import { shouldDispatchQueueJobs } from '../config/job-processing.js';

export type StoreDirectorySyncJobData = {
  source?: string;
};

let storeDirectorySyncQueue: Queue<
  StoreDirectorySyncJobData,
  void,
  'sync-store-directory'
> | null = null;

export const getStoreDirectorySyncQueue = (): Queue<
  StoreDirectorySyncJobData,
  void,
  'sync-store-directory'
> => {
  if (!storeDirectorySyncQueue) {
    storeDirectorySyncQueue = new Queue<
      StoreDirectorySyncJobData,
      void,
      'sync-store-directory'
    >('store-directory-sync-queue', {
      connection: getBullMqConnection()
    });

    storeDirectorySyncQueue.on('error', (error) => {
      logger.error('[queue] Store-directory sync queue connection error', {
        message: error.message,
        code: (error as NodeJS.ErrnoException).code
      });
    });
  }

  return storeDirectorySyncQueue;
};

export const enqueueStoreDirectorySync = async (source = 'manual'): Promise<void> => {
  if (!shouldDispatchQueueJobs()) {
    logger.debug('[queue] Skipping store-directory sync enqueue — inline processing or test');
    return;
  }

  try {
    await getStoreDirectorySyncQueue().add(
      'sync-store-directory',
      { source },
      {
        jobId: 'store-directory-sync-active',
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: 50
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('exist')) {
      logger.info('[queue] Store-directory sync already queued — skipping overlap');
      return;
    }
    throw error;
  }
};
