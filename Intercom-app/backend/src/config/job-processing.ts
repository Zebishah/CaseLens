import { env } from './env.config.js';

export type JobProcessingMode = 'inline' | 'bullmq' | 'apify';

export const isInlineJobProcessing = (): boolean => env.JOB_PROCESSING_MODE === 'inline';

export const isBullmqJobProcessing = (): boolean => env.JOB_PROCESSING_MODE === 'bullmq';

export const isApifyJobProcessing = (): boolean => env.JOB_PROCESSING_MODE === 'apify';

/** Workers and queue clients must not start in inline mode or in Jest. */
export const shouldStartQueueWorkers = (
  mode: JobProcessingMode = env.JOB_PROCESSING_MODE,
  runWorkers: boolean = env.RUN_WORKERS,
  nodeEnv: string = env.NODE_ENV
): boolean => mode === 'bullmq' && runWorkers && nodeEnv !== 'test';

export const shouldDispatchQueueJobs = (
  mode: JobProcessingMode = env.JOB_PROCESSING_MODE,
  nodeEnv: string = env.NODE_ENV
): boolean => mode === 'bullmq' && nodeEnv !== 'test';
