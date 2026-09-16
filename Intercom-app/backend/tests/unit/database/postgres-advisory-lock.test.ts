import { describe, expect, test, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { ADVISORY_LOCK_NAMESPACE, withPostgresAdvisoryLock } from '../../../src/database/postgres-advisory-lock.js';

const makeClient = () => {
  const calls: Array<{ query: string; values?: unknown[] }> = [];
  const release = jest.fn();
  const client = {
    query: async (query: string, values?: unknown[]) => {
      calls.push({ query, values });
      return { rows: [] };
    },
    release
  } as unknown as PoolClient;
  return { calls, client, release };
};

describe('Postgres advisory processing locks', () => {
  test('holds a session lock around the critical section and releases it on success', async () => {
    const fixture = makeClient();
    const operation = jest.fn(async () => 'complete');
    const result = await withPostgresAdvisoryLock(
      ADVISORY_LOCK_NAMESPACE.intelligenceConversation,
      41,
      operation,
      async () => fixture.client
    );
    expect(result).toBe('complete');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fixture.calls.map((call) => call.values)).toEqual([
      [ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 41],
      [ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 41]
    ]);
    expect(fixture.calls[1]?.query).toContain('pg_advisory_unlock');
    expect(fixture.release).toHaveBeenCalledTimes(1);
  });

  test('releases the lock and client after processing throws', async () => {
    const fixture = makeClient();
    await expect(
      withPostgresAdvisoryLock(
        ADVISORY_LOCK_NAMESPACE.intelligenceConversation,
        41,
        async () => { throw new Error('processing failed'); },
        async () => fixture.client
      )
    ).rejects.toThrow('processing failed');
    expect(fixture.calls[1]?.query).toContain('pg_advisory_unlock');
    expect(fixture.release).toHaveBeenCalledTimes(1);
  });

  test('uses different advisory keys for independent conversations', async () => {
    const seen: unknown[][] = [];
    const connect = async () => {
      const client = {
        query: async (_query: string, values?: unknown[]) => { if (values) seen.push(values); return { rows: [] }; },
        release: () => undefined
      } as unknown as PoolClient;
      return client;
    };
    await Promise.all([
      withPostgresAdvisoryLock(ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 12, async () => undefined, connect),
      withPostgresAdvisoryLock(ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 13, async () => undefined, connect)
    ]);
    expect(seen).toContainEqual([ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 12]);
    expect(seen).toContainEqual([ADVISORY_LOCK_NAMESPACE.intelligenceConversation, 13]);
    expect(ADVISORY_LOCK_NAMESPACE.intelligenceConversation).not.toBe(ADVISORY_LOCK_NAMESPACE.outboxRecovery);
  });
});
