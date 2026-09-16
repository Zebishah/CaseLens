import { actorInputSchema, type ActorInput } from '../integrations/apify/actor-input.schema.js';
import type { IntercomIntelligenceJobData } from '../queues/intercom-intelligence.queue.js';

export type ActorOutput = {
  type: ActorInput['type'];
  status: 'completed' | 'skipped';
  durationMs: number;
  conversationId?: number;
  sourceRevision?: string;
  dispatchedCount?: number;
  pendingCount?: number;
  failedCount?: number;
  storesUpserted?: number;
};

export type ActorRuntimeDependencies = {
  handleIntelligenceJob: (job: IntercomIntelligenceJobData) => Promise<void>;
  recoverPendingOutbox: (limit: number) => Promise<number>;
  countPendingOutbox: () => Promise<number>;
  retryFailedActorRuns: (limit: number) => Promise<{ dispatched: number; failed: number }>;
  reconcileStaleActorRuns: (limit: number) => Promise<{ failed: number; completed: number }>;
  syncStoreDirectory: (source: string) => Promise<{ ok: boolean; skipped?: boolean; storesUpserted: number }>;
};

export const executeActorInput = async (
  rawInput: unknown,
  dependencies: ActorRuntimeDependencies,
  now: () => number = Date.now
): Promise<ActorOutput> => {
  const input = actorInputSchema.parse(rawInput);
  const startedAt = now();
  switch (input.type) {
    case 'intelligence':
      await dependencies.handleIntelligenceJob({
        conversationId: input.conversationId,
        intercomId: input.intercomId,
        sourceRevision: input.sourceRevision,
        skipSync: input.skipSync,
        forceReprocess: input.forceReprocess,
        skipPeerRefresh: input.skipPeerRefresh
      });
      return {
        type: input.type,
        status: 'completed',
        conversationId: input.conversationId,
        sourceRevision: input.sourceRevision,
        durationMs: Math.max(0, now() - startedAt)
      };
    case 'peer-refresh':
      await dependencies.handleIntelligenceJob({
        conversationId: input.conversationId,
        intercomId: input.intercomId,
        sourceRevision: input.sourceRevision,
        skipSync: true,
        skipPeerRefresh: true,
        peerSnapshotRefresh: {
          caseType: input.caseType,
          employeeIdentityIds: input.employeeIdentityIds,
          relatedCaseSearchScope: input.relatedCaseSearchScope,
          enqueueSiblingReprocess: input.enqueueSiblingReprocess
        }
      });
      return {
        type: input.type,
        status: 'completed',
        conversationId: input.conversationId,
        sourceRevision: input.sourceRevision,
        durationMs: Math.max(0, now() - startedAt)
      };
    case 'recover-pending-outbox': {
      const pendingCount = await dependencies.countPendingOutbox();
      const dispatchedCount = await dependencies.recoverPendingOutbox(input.limit);
      const reconciled = await dependencies.reconcileStaleActorRuns(input.limit);
      const retried = await dependencies.retryFailedActorRuns(input.limit);
      return {
        type: input.type,
        status: 'completed',
        pendingCount,
        dispatchedCount: dispatchedCount + retried.dispatched,
        failedCount: reconciled.failed + retried.failed,
        durationMs: Math.max(0, now() - startedAt)
      };
    }
    case 'store-directory-sync': {
      const result = await dependencies.syncStoreDirectory(input.source);
      if (!result.ok) throw new Error('Store directory sync failed.');
      return {
        type: input.type,
        status: result.skipped ? 'skipped' : 'completed',
        storesUpserted: result.storesUpserted,
        durationMs: Math.max(0, now() - startedAt)
      };
    }
  }
};

export const withActorDatabaseLifecycle = async <T>(
  operation: () => Promise<T>,
  closeDatabase: () => Promise<void>
): Promise<T> => {
  try {
    return await operation();
  } finally {
    await closeDatabase();
  }
};
