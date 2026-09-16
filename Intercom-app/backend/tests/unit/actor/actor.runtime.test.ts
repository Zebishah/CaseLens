import { describe, expect, test, jest } from '@jest/globals';
import { executeActorInput, withActorDatabaseLifecycle } from '../../../src/actor/actor.runtime.js';

const dependencies = () => ({
  handleIntelligenceJob: jest.fn(async () => undefined),
  recoverPendingOutbox: jest.fn(async () => 2),
  countPendingOutbox: jest.fn(async () => 3),
  retryFailedActorRuns: jest.fn(async () => ({ dispatched: 1, failed: 0 })),
  reconcileStaleActorRuns: jest.fn(async () => ({ failed: 0, completed: 0 })),
  syncStoreDirectory: jest.fn(async () => ({ ok: true, storesUpserted: 9 }))
});

describe('HR Actor runtime', () => {
  test('validates intelligence input and calls the shared handler with metadata only', async () => {
    const deps = dependencies();
    const result = await executeActorInput({
      type: 'intelligence',
      conversationId: 12,
      intercomId: 'ic-123',
      sourceRevision: '7-42',
      skipSync: true,
      forceReprocess: false,
      skipPeerRefresh: false
    }, deps);
    expect(deps.handleIntelligenceJob).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 12,
      intercomId: 'ic-123',
      sourceRevision: '7-42',
      skipSync: true
    }));
    expect(result).toMatchObject({ type: 'intelligence', conversationId: 12, status: 'completed' });
    expect(JSON.stringify(result)).not.toContain('conversation body');
  });

  test('runs peer refresh through the shared intelligence handler', async () => {
    const deps = dependencies();
    await executeActorInput({
      type: 'peer-refresh',
      conversationId: 12,
      intercomId: 'ic-123',
      caseType: 'attendance',
      employeeIdentityIds: [4],
      relatedCaseSearchScope: { mode: 'none', storeNumber: null, domain: null },
      enqueueSiblingReprocess: true
    }, deps);
    expect(deps.handleIntelligenceJob).toHaveBeenCalledWith(expect.objectContaining({
      skipSync: true,
      peerSnapshotRefresh: expect.objectContaining({ enqueueSiblingReprocess: true })
    }));
  });

  test('bounds recovery and returns safe counts', async () => {
    const deps = dependencies();
    const result = await executeActorInput({ type: 'recover-pending-outbox', limit: 20 }, deps);
    expect(deps.recoverPendingOutbox).toHaveBeenCalledWith(20);
    expect(deps.retryFailedActorRuns).toHaveBeenCalledWith(20);
    expect(result).toMatchObject({ type: 'recover-pending-outbox', pendingCount: 3, dispatchedCount: 3 });
  });

  test('runs scheduled store sync and safely reports a disabled Box integration', async () => {
    const deps = dependencies();
    deps.syncStoreDirectory.mockResolvedValue({ ok: true, skipped: true, storesUpserted: 0 });
    const result = await executeActorInput({ type: 'store-directory-sync', source: 'apify-schedule' }, deps);
    expect(result).toMatchObject({ type: 'store-directory-sync', status: 'skipped', storesUpserted: 0 });
  });

  test.each([
    { type: 'unknown-job' },
    { type: 'intelligence', intercomId: 'ic-123' },
    { type: 'intelligence', conversationId: 12, intercomId: 'ic-123', body: 'private content' }
  ])('rejects invalid or unknown Actor input %#', async (input) => {
    await expect(executeActorInput(input, dependencies())).rejects.toThrow();
  });

  test('closes database after success and failure', async () => {
    const close = jest.fn(async () => undefined);
    await expect(withActorDatabaseLifecycle(async () => 'done', close)).resolves.toBe('done');
    await expect(withActorDatabaseLifecycle(async () => { throw new Error('failed'); }, close)).rejects.toThrow('failed');
    expect(close).toHaveBeenCalledTimes(2);
  });
});
