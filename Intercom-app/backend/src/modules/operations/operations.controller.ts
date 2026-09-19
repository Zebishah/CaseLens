import type { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { getBullMqConnection } from '../../config/redis.connection.js';
import { env } from '../../config/env.config.js';
import { sendSuccess } from '../../utils/response.util.js';
import { AppError } from '../../utils/error.util.js';
import { enqueueIntercomIntelligence } from '../../queues/intercom-intelligence.queue.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import { ingestionService } from '../ingestion/ingestion.service.js';
import { processCaseIntelligence } from '../intelligence/process-case-intelligence.js';
import { syncIntercomIntelligence } from '../intercom/intercom.sync.service.js';
import { intelligenceActorRunRepository } from '../ingestion/intelligence-actor-run.repository.js';
import { healthService } from '../health/health.service.js';
import { operationalMetrics } from '../../observability/metrics.js';

const queue = () =>
  new Queue('intercom-intelligence-queue', { connection: getBullMqConnection() });

const safeJob = (job: {
  id?: string;
  name?: string;
  attemptsMade?: number;
  failedReason?: string;
  data?: { conversationId?: number; intercomId?: string; correlationId?: string };
}) => ({
  id: job.id,
  name: job.name,
  attempts: job.attemptsMade ?? 0,
  safeError: job.failedReason ? job.failedReason.slice(0, 280) : null,
  conversationId: job.data?.conversationId ?? null,
  correlationId: job.data?.correlationId ?? null
});

export const operationsController = {
  async metrics(_req: Request, res: Response): Promise<void> {
    const [readiness, pendingOutbox] = await Promise.all([
      healthService.readiness(),
      ingestionRepository.countPendingOutbox()
    ]);
    const metrics = operationalMetrics.snapshot();
    sendSuccess(res, {
      status: readiness.status === 'ready' ? 'healthy' : 'starting',
      database: { reachable: readiness.postgres === 'up' },
      redis: {
        configured: readiness.redisConfigured,
        reachable: readiness.redisReachable,
        ...metrics.redis
      },
      jobs: metrics.apify,
      outbox: { pending: pendingOutbox, recovered: metrics.outbox.recovered },
      ai: { ...metrics.ai, mode: env.LLM_MODE },
      api: metrics.api
    });
  },

  async reviewerSummary(_req: Request, res: Response): Promise<void> {
    const [pendingOutbox, actorRuns] = await Promise.all([
      ingestionRepository.countPendingOutbox(),
      env.JOB_PROCESSING_MODE === 'apify'
        ? intelligenceActorRunRepository.operationalSummary(env.APIFY_MAX_ATTEMPTS)
        : Promise.resolve(null)
    ]);

    sendSuccess(res, {
      jobProcessingMode: env.JOB_PROCESSING_MODE,
      actorRuns: actorRuns
        ? {
            queued: actorRuns.queued,
            running: actorRuns.running,
            completed: actorRuns.completed,
            failed: actorRuns.failed,
            retryableFailures: actorRuns.retryableFailures,
            latestFailureCode: actorRuns.latestFailureCode,
            recentRunDurationMs: actorRuns.recentRunDurationMs
          }
        : null,
      pendingOutbox,
      recoveryStatus: pendingOutbox === 0 ? 'clear' : 'pending'
    });
  },

  async summary(_req: Request, res: Response): Promise<void> {
    const [duplicateEventsPrevented, pendingOutbox, lastIntercomEvent, intercomSync] = await Promise.all([
      ingestionRepository.countDuplicatesPrevented(),
      ingestionRepository.countPendingOutbox(),
      ingestionRepository.latestBySource('intercom'),
      conversationRepository.intercomSyncSummary()
    ]);

    const intercom = {
      enabled: env.INTERCOM_ENABLED,
      connected: env.INTERCOM_ENABLED,
      workspace: env.INTERCOM_ENABLED ? 'Developer workspace' : null,
      lastWebhookAt: lastIntercomEvent?.receivedAt ?? null,
      lastWebhookTopic: lastIntercomEvent?.eventType ?? null,
      lastSuccessfulWritebackAt: intercomSync.lastSyncedAt,
      writebackFailures: intercomSync.failed,
      writebacksSynced: intercomSync.synced
    };

    if (env.JOB_PROCESSING_MODE === 'inline') {
      sendSuccess(res, {
        jobProcessingMode: 'inline',
        workersEnabled: false,
        pendingOutbox,
        queues: null,
        deadLetter: [],
        duplicateEventsPrevented,
        intercom,
        message: 'Queue metrics are available when JOB_PROCESSING_MODE=bullmq.'
      });
      return;
    }

    const intelligence = queue();
    const counts = await intelligence.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused');
    const failed = await intelligence.getJobs(['failed'], 0, 25);
    await intelligence.close();

    sendSuccess(res, {
      jobProcessingMode: env.JOB_PROCESSING_MODE,
      workersEnabled: env.RUN_WORKERS,
      pendingOutbox,
      queues: {
        intelligence: counts
      },
      deadLetter: failed.map(safeJob),
      duplicateEventsPrevented,
      intercom
    });
  },

  async replay(req: Request, res: Response): Promise<void> {
    const conversationId = Number(req.params.conversationId);
    const force = req.body?.force === true;
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) {
      throw AppError.notFound('Case not found');
    }

    if (
      conversation.intelligenceStatus === 'ready' &&
      conversation.intelligenceSnapshot &&
      !force
    ) {
      throw AppError.conflict('Refusing to replay a completed case without an explicit force flag');
    }

    if (env.JOB_PROCESSING_MODE === 'inline') {
      await conversationRepository.claimIntelligenceProcessing(conversation.id);
      await processCaseIntelligence({
        conversationId: conversation.id,
        forceReprocess: true,
        skipPeerRefresh: true,
        source: 'inline'
      });
      sendSuccess(res, { processed: true, conversationId: conversation.id });
      return;
    }

    await enqueueIntercomIntelligence(
      {
        conversationId: conversation.id,
        intercomId: conversation.intercomId,
        skipSync: conversation.source !== 'intercom',
        forceReprocess: true
      },
      { jobId: `replay-${conversation.id}-${Date.now()}` }
    );

    sendSuccess(res, { queued: true, conversationId: conversation.id });
  },

  async retryIntercomSync(req: Request, res: Response): Promise<void> {
    const conversationId = Number(req.params.conversationId);
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) {
      throw AppError.notFound('Case not found');
    }
    const result = await syncIntercomIntelligence(conversation.id);
    sendSuccess(res, result);
  },

  async recoverOutbox(_req: Request, res: Response): Promise<void> {
    const dispatched = await ingestionService.recoverPendingOutbox();
    sendSuccess(res, { dispatched });
  }
};
