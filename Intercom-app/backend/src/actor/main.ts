import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { actorInputSchema } from '../integrations/apify/actor-input.schema.js';
import { executeActorInput } from './actor.runtime.js';

type ActorPlatformEnvironment = NodeJS.ProcessEnv & {
  ACTOR_DEFAULT_KEY_VALUE_STORE_ID?: string;
  ACTOR_INPUT_KEY?: string;
  ACTOR_RUN_ID?: string;
};

const apiBase = (): string => (process.env.APIFY_API_BASE_URL ?? 'https://api.apify.com/v2').replace(/\/$/, '');

const readInput = async (): Promise<unknown> => {
  const actorEnv = process.env as ActorPlatformEnvironment;
  const storeId = actorEnv.ACTOR_DEFAULT_KEY_VALUE_STORE_ID ?? process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  const recordKey = actorEnv.ACTOR_INPUT_KEY ?? 'INPUT';
  const token = process.env.APIFY_TOKEN;
  if (storeId && token) {
    const response = await fetch(
      `${apiBase()}/key-value-stores/${encodeURIComponent(storeId)}/records/${encodeURIComponent(recordKey)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error('Actor input could not be loaded from the Apify key-value store.');
    return response.json();
  }

  const storageRoot = process.env.APIFY_LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), 'storage');
  const inputPath = path.join(storageRoot, 'key_value_stores', 'default', `${recordKey}.json`);
  return JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
};

const writeOutput = async (output: unknown): Promise<void> => {
  const actorEnv = process.env as ActorPlatformEnvironment;
  const storeId = actorEnv.ACTOR_DEFAULT_KEY_VALUE_STORE_ID ?? process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  const token = process.env.APIFY_TOKEN;
  if (storeId && token) {
    const response = await fetch(
      `${apiBase()}/key-value-stores/${encodeURIComponent(storeId)}/records/OUTPUT`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(output)
      }
    );
    if (!response.ok) throw new Error('Actor output could not be stored.');
    return;
  }

  const storageRoot = process.env.APIFY_LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), 'storage');
  const outputPath = path.join(storageRoot, 'key_value_stores', 'default', 'OUTPUT.json');
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output), 'utf8');
};

const run = async (): Promise<void> => {
  if (process.env.APIFY_TOKEN && !process.env.APIFY_API_TOKEN) {
    process.env.APIFY_API_TOKEN = process.env.APIFY_TOKEN;
  }
  process.env.JOB_PROCESSING_MODE = 'apify';
  process.env.NODE_ENV = 'production';
  process.env.RUN_API = 'false';
  process.env.RUN_WORKERS = 'false';
  process.env.DATABASE_POOL_MAX ??= '4';
  if (!process.env.APIFY_ACTOR_ID && process.env.ACTOR_ID) {
    process.env.APIFY_ACTOR_ID = process.env.ACTOR_ID;
  }
  // These values are unused by the Actor's business handlers. Keep the shared API env parser
  // satisfied without placing long-lived authentication secrets in the Actor configuration.
  process.env.JWT_SECRET ??= `actor-${randomUUID()}-access`;
  process.env.JWT_REFRESH_SECRET ??= `actor-${randomUUID()}-refresh`;
  process.env.INTERCOM_CLIENT_SECRET ??= 'unused-by-actor-runtime';

  let actorOutput: unknown;
  let failed = false;
  let safeFailure: { code: string; message: string; retryable: boolean } | undefined;
  const rawInput = await readInput();
  const input = actorInputSchema.parse(rawInput);
  const executionId: number | undefined = 'executionId' in input ? input.executionId : undefined;
  const startedAt = Date.now();

  let database: typeof import('../database/connection.js') | undefined;
  try {
    database = await import('../database/connection.js');
    const [handler, ingestion, ingestionRepo, actorRuns, storeDirectory, loggerModule] = await Promise.all([
      import('../jobs/intelligence-job.handler.js'),
      import('../modules/ingestion/ingestion.service.js'),
      import('../modules/ingestion/ingestion.repository.js'),
      import('../modules/ingestion/intelligence-actor-run.repository.js'),
      import('../modules/store-directory/store-directory.sync.service.js'),
      import('../config/logger.config.js')
    ]);
    const runtime = async (): Promise<unknown> => {
      if (executionId) await actorRuns.intelligenceActorRunRepository.markStarted(executionId);
      loggerModule.logger.info('[actor] HR job started', {
        jobType: input.type,
        ...(input.type === 'intelligence' || input.type === 'peer-refresh'
          ? { conversationId: input.conversationId }
          : {}),
        attempt: 'attempt' in input ? input.attempt : undefined
      });
      const result = await executeActorInput(input, {
        handleIntelligenceJob: handler.handleIntelligenceJob,
        recoverPendingOutbox: ingestion.ingestionService.recoverPendingOutbox,
        countPendingOutbox: ingestionRepo.ingestionRepository.countPendingOutbox,
        retryFailedActorRuns: (limit) => import('../integrations/apify/apify-dispatch.service.js').then((m) => m.retryFailedActorRuns(limit)),
        reconcileStaleActorRuns: (limit) => import('../integrations/apify/apify-dispatch.service.js').then((m) => m.reconcileStaleActorRuns(limit)),
        syncStoreDirectory: storeDirectory.syncStoreDirectoryFromBox
      });
      if (executionId) await actorRuns.intelligenceActorRunRepository.markCompleted(executionId);
      loggerModule.logger.info('[actor] HR job completed', {
        jobType: input.type,
        ...(input.type === 'intelligence' || input.type === 'peer-refresh'
          ? { conversationId: input.conversationId }
          : {}),
        durationMs: Date.now() - startedAt,
        status: 'completed'
      });
      if (input.type === 'recover-pending-outbox') {
        const recoveryOutput = result as Record<string, unknown>;
        loggerModule.logger.info('[actor] Outbox recovery completed', {
          pendingCount: recoveryOutput.pendingCount,
          dispatchedCount: recoveryOutput.dispatchedCount,
          failedCount: recoveryOutput.failedCount
        });
      }
      return result;
    };

    try {
      actorOutput = await runtime();
    } catch (error) {
      const { classifyProcessingError } = await import('../modules/ingestion/error-classification.js');
      const classified = classifyProcessingError(error);
      const attempt = 'attempt' in input ? input.attempt ?? 1 : 1;
      safeFailure = {
        code: classified.code,
        message: classified.safeMessage,
        retryable: classified.retryable && attempt < (Number(process.env.APIFY_MAX_ATTEMPTS) || 3)
      };
      failed = true;
      if (executionId) {
        await actorRuns.intelligenceActorRunRepository.markFailed({
          id: executionId,
          code: safeFailure.code,
          safeMessage: safeFailure.message,
          retryable: safeFailure.retryable,
          attemptCount: attempt
        });
      }
      actorOutput = {
        type: input.type,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        errorCode: safeFailure.code,
        retryable: safeFailure.retryable
      };
      loggerModule.logger.error('[actor] HR job failed', {
        jobType: input.type,
        ...(input.type === 'intelligence' || input.type === 'peer-refresh'
          ? { conversationId: input.conversationId }
          : {}),
        durationMs: Date.now() - startedAt,
        code: safeFailure.code,
        retryable: safeFailure.retryable
      });
    }
  } catch {
    failed = true;
    safeFailure ??= { code: 'ACTOR_RUNTIME_ERROR', message: 'The Actor could not execute this job.', retryable: false };
    actorOutput = {
      type: input.type,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      errorCode: safeFailure.code,
      retryable: safeFailure.retryable
    };
    if (executionId) {
      try {
        const { intelligenceActorRunRepository } = await import('../modules/ingestion/intelligence-actor-run.repository.js');
        await intelligenceActorRunRepository.markFailed({
          id: executionId,
          code: safeFailure.code,
          safeMessage: safeFailure.message,
          retryable: safeFailure.retryable,
          attemptCount: 'attempt' in input ? input.attempt ?? 1 : 1
        });
      } catch {
        // The next scheduled recovery reconciles the durable running row.
      }
    }
  } finally {
    if (database) await database.pool.end();
  }

  try {
    await writeOutput(actorOutput);
  } catch {
    failed = true;
  }
  if (failed) process.exitCode = 1;
};

void run().catch((error: unknown) => {
  // Keep provider and HR payload details out of Actor logs and output.
  void error;
  process.exitCode = 1;
});
