import { env } from '../../config/env.config.js';
import { isBullmqJobProcessing, isApifyJobProcessing, shouldStartQueueWorkers } from '../../config/job-processing.js';
import { getSharedRedis } from '../../config/redis.config.js';

export const healthService = {
  liveness() {
    return { status: 'ok' as const };
  },

  async readiness(): Promise<{
    status: 'ready' | 'starting';
    postgres: 'up' | 'down';
    redis: 'up' | 'down' | 'disabled';
  }> {
    let postgres: 'up' | 'down' = 'down';
    let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';

    try {
      const { pool } = await import('../../database/connection.js');
      await pool.query('select 1');
      postgres = 'up';
    } catch {
      postgres = 'down';
    }

    if (isBullmqJobProcessing()) {
      try {
        const client = getSharedRedis();
        if (!client) {
          redisStatus = 'down';
        } else {
          const pong = await client.ping();
          redisStatus = pong === 'PONG' ? 'up' : 'down';
        }
      } catch {
        redisStatus = 'down';
      }
    }

    const apifyConfigured = Boolean(env.APIFY_API_TOKEN && env.APIFY_ACTOR_ID);
    const ready =
      postgres === 'up' &&
      (redisStatus === 'up' || redisStatus === 'disabled') &&
      (!isApifyJobProcessing() || apifyConfigured);
    return {
      status: ready ? 'ready' : 'starting',
      postgres,
      redis: redisStatus
    };
  },

  processFlags() {
    return {
      runApi: env.RUN_API,
      runWorkers: env.RUN_WORKERS,
      workersEnabled: shouldStartQueueWorkers(),
      jobProcessingMode: env.JOB_PROCESSING_MODE,
      apifyConfigured: Boolean(env.APIFY_API_TOKEN && env.APIFY_ACTOR_ID),
      intercomEnabled: env.INTERCOM_ENABLED,
      boxSyncEnabled: env.BOX_SYNC_ENABLED,
      resendEnabled: env.RESEND_ENABLED,
      llmMode: env.LLM_MODE
    };
  }
};
