import { Worker } from 'bullmq';
import { getBullMqConnection } from '../config/redis.connection.js';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import { isBoxStoreDirectoryConfigured } from '../modules/box/box.client.js';
import { syncStoreDirectoryFromBox } from '../modules/store-directory/store-directory.sync.service.js';
import {
  getStoreDirectorySyncQueue,
  type StoreDirectorySyncJobData
} from '../queues/store-directory-sync.queue.js';

let worker: Worker<StoreDirectorySyncJobData, void, 'sync-store-directory'> | null = null;

const ensureMidnightRepeatableJob = async (): Promise<void> => {
  if (!isBoxStoreDirectoryConfigured()) {
    logger.info('[store-directory] Box not configured — midnight sync not scheduled');
    return;
  }

  const queue = getStoreDirectorySyncQueue();
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === 'sync-store-directory') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(
    'sync-store-directory',
    { source: 'midnight-cron' },
    {
      repeat: { pattern: env.STORE_DIRECTORY_SYNC_CRON },
      attempts: 2,
      removeOnComplete: 20,
      removeOnFail: 50
    }
  );

  logger.info('[store-directory] Midnight sync scheduled', {
    cron: env.STORE_DIRECTORY_SYNC_CRON
  });
};

export const startStoreDirectorySyncWorker = (): Worker<
  StoreDirectorySyncJobData,
  void,
  'sync-store-directory'
> => {
  if (worker) {
    return worker;
  }

  worker = new Worker<StoreDirectorySyncJobData, void, 'sync-store-directory'>(
    'store-directory-sync-queue',
    async (job) => {
      const source = job.data.source ?? 'worker';
      logger.info('[worker] Store-directory sync started', { jobId: job.id, source });
      const result = await syncStoreDirectoryFromBox(source);
      if (!result.ok) {
        throw new Error(result.errorMessage ?? 'Store-directory sync failed');
      }
      logger.info('[worker] Store-directory sync finished', {
        jobId: job.id,
        storesUpserted: result.storesUpserted,
        skipped: result.skipped ?? false
      });
    },
    { connection: getBullMqConnection() }
  );

  worker.on('failed', (job, error) => {
    logger.error('[worker] Store-directory sync job failed', {
      jobId: job?.id,
      error: error.message
    });
  });

  worker.on('error', (error) => {
    logger.error('[worker] Store-directory sync worker connection error', {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code
    });
  });

  void ensureMidnightRepeatableJob().catch((error) => {
    logger.error('[store-directory] Failed to schedule midnight sync', {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  return worker;
};
