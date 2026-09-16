import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import type { IntercomIntelligenceJobData } from '../../queues/intercom-intelligence.queue.js';
import { intelligenceActorRunRepository } from '../../modules/ingestion/intelligence-actor-run.repository.js';
import { actorInputSchema, type ActorInput } from './actor-input.schema.js';
import { apifyClient, ApifyClientError } from './apify.client.js';

const toActorInput = (data: IntercomIntelligenceJobData): ActorInput => {
  if (data.peerSnapshotRefresh) {
    return actorInputSchema.parse({
      type: 'peer-refresh',
      conversationId: data.conversationId,
      intercomId: data.intercomId,
      sourceRevision: data.sourceRevision,
      caseType: data.peerSnapshotRefresh.caseType,
      employeeIdentityIds: data.peerSnapshotRefresh.employeeIdentityIds,
      relatedCaseSearchScope: data.peerSnapshotRefresh.relatedCaseSearchScope,
      enqueueSiblingReprocess: data.peerSnapshotRefresh.enqueueSiblingReprocess
    });
  }
  return actorInputSchema.parse({
    type: 'intelligence',
    conversationId: data.conversationId,
    intercomId: data.intercomId,
    sourceRevision: data.sourceRevision,
    skipSync: data.skipSync ?? false,
    forceReprocess: data.forceReprocess ?? false,
    skipPeerRefresh: data.skipPeerRefresh ?? false
  });
};

const getErrorInfo = (error: unknown): { code: string; message: string; retryable: boolean; status?: number } => {
  if (error instanceof ApifyClientError) {
    return {
      code: `APIFY_${error.code.toUpperCase()}`,
      message: error.message,
      retryable: ['rate_limited', 'upstream_unavailable', 'transport_error'].includes(error.code),
      status: error.status
    };
  }
  return { code: 'APIFY_DISPATCH_FAILED', message: 'Apify dispatch failed.', retryable: true };
};

export const dispatchActorPayload = async (
  input: ActorInput,
  metadata: { conversationId?: number; jobType: string; sourceRevision?: string }
): Promise<{ runId: string }> => {
  const startedAt = Date.now();
  const run = await apifyClient().startActorRun(input);
  logger.info('[apify] Actor run started', {
    runId: run.id,
    ...(metadata.conversationId ? { conversationId: metadata.conversationId } : {}),
    jobType: metadata.jobType,
    ...(metadata.sourceRevision ? { sourceRevision: metadata.sourceRevision } : {}),
    status: run.status,
    elapsedMs: Date.now() - startedAt
  });
  return { runId: run.id };
};

export const dispatchApifyIntelligenceJob = async (
  data: IntercomIntelligenceJobData
): Promise<{ runId: string; duplicate: boolean }> => {
  const baseInput = toActorInput(data);
  const jobType = baseInput.type;
  const forceReprocess = baseInput.type === 'intelligence' && baseInput.forceReprocess;
  const dedupeKey =
    baseInput.type === 'intelligence' && !forceReprocess && baseInput.sourceRevision
      ? `revision:${baseInput.sourceRevision}`
      : `execution:${randomUUID()}`;
  const safeInput = { ...baseInput } as Record<string, unknown>;
  const { row, created } = await intelligenceActorRunRepository.createOrGet({
    conversationId: data.conversationId,
    intercomId: data.intercomId,
    sourceRevision: baseInput.type === 'recover-pending-outbox' || baseInput.type === 'store-directory-sync'
      ? null
      : baseInput.sourceRevision ?? null,
    jobType,
    dedupeKey,
    status: 'queued',
    attemptCount: 1,
    forceReprocess: forceReprocess ?? false,
    skipSync: baseInput.type === 'intelligence' ? baseInput.skipSync : true,
    skipPeerRefresh: baseInput.type === 'intelligence' ? baseInput.skipPeerRefresh : true,
    retryable: false,
    input: safeInput
  });

  if (!created && row.apifyRunId) {
    logger.info('[apify] Duplicate revision dispatch coalesced', {
      runId: row.apifyRunId,
      conversationId: row.conversationId,
      jobType,
      sourceRevision: row.sourceRevision
    });
    return { runId: row.apifyRunId, duplicate: true };
  }
  if (!created) {
    throw new Error('Apify dispatch is awaiting recovery after an interrupted start.');
  }

  const input = actorInputSchema.parse({ ...baseInput, executionId: row.id, attempt: row.attemptCount });
  try {
    const { runId } = await dispatchActorPayload(input, {
      conversationId: data.conversationId,
      jobType,
      sourceRevision: data.sourceRevision
    });
    await intelligenceActorRunRepository.attachApifyRun(row.id, runId);
    return { runId, duplicate: false };
  } catch (error) {
    const info = getErrorInfo(error);
    await intelligenceActorRunRepository.markFailed({
      id: row.id,
      code: info.code,
      safeMessage: info.message,
      retryable: info.retryable,
      attemptCount: row.attemptCount
    });
    logger.error('[apify] Actor dispatch failed', {
      ...(info.status ? { status: info.status } : {}),
      conversationId: data.conversationId,
      jobType,
      sourceRevision: data.sourceRevision,
      code: info.code
    });
    throw error;
  }
};

export const retryFailedActorRuns = async (limit = 20): Promise<{ dispatched: number; failed: number }> => {
  const candidates = await intelligenceActorRunRepository.listRetryable(env.APIFY_MAX_ATTEMPTS, limit);
  let dispatched = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const row = await intelligenceActorRunRepository.claimRetry(candidate.id, env.APIFY_MAX_ATTEMPTS);
    if (!row) continue;
    try {
      const input = actorInputSchema.parse({
        ...row.input,
        executionId: row.id,
        attempt: row.attemptCount
      });
      const { runId } = await dispatchActorPayload(input, {
        conversationId: row.conversationId,
        jobType: row.jobType,
        sourceRevision: row.sourceRevision ?? undefined
      });
      await intelligenceActorRunRepository.attachApifyRun(row.id, runId);
      dispatched += 1;
    } catch (error) {
      failed += 1;
      const info = getErrorInfo(error);
      await intelligenceActorRunRepository.markFailed({
        id: row.id,
        code: info.code,
        safeMessage: info.message,
        retryable: info.retryable,
        attemptCount: row.attemptCount
      });
    }
  }
  return { dispatched, failed };
};

export const reconcileStaleActorRuns = async (limit = 20): Promise<{ failed: number; completed: number }> => {
  const stale = await intelligenceActorRunRepository.listStale(limit, new Date(Date.now() - 5 * 60_000));
  let failed = 0;
  let completed = 0;
  for (const row of stale) {
    if (!row.apifyRunId) {
      await intelligenceActorRunRepository.markFailed({
        id: row.id,
        code: 'APIFY_START_UNCONFIRMED',
        safeMessage: 'Apify did not confirm the run start before the dispatcher stopped.',
        retryable: row.attemptCount < env.APIFY_MAX_ATTEMPTS,
        attemptCount: row.attemptCount
      });
      failed += 1;
      continue;
    }
    try {
      const run = await apifyClient().getActorRun(row.apifyRunId);
      if (run.status === 'SUCCEEDED') {
        await intelligenceActorRunRepository.markCompleted(row.id);
        completed += 1;
      } else if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status ?? '')) {
        await intelligenceActorRunRepository.markFailed({
          id: row.id,
          code: 'APIFY_RUN_FAILED',
          safeMessage: 'The Apify run ended before the job completed.',
          retryable: row.attemptCount < env.APIFY_MAX_ATTEMPTS,
          attemptCount: row.attemptCount
        });
        failed += 1;
      }
    } catch {
      // A transient status lookup failure is retried on the next scheduled recovery run.
    }
  }
  return { failed, completed };
};
