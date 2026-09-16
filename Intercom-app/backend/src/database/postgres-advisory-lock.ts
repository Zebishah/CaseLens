import type { PoolClient } from 'pg';
import { pool } from './connection.js';

export const ADVISORY_LOCK_NAMESPACE = {
  intelligenceConversation: 1_204_525_273,
  outboxRecovery: 1_204_525_274
} as const;

export const withPostgresAdvisoryLock = async <T>(
  namespace: number,
  resourceId: number,
  operation: () => Promise<T>,
  connect: () => Promise<PoolClient> = () => pool.connect()
): Promise<T> => {
  const client = await connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [namespace, resourceId]);
    locked = true;
    return await operation();
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [namespace, resourceId]).catch(() => undefined);
    }
    client.release();
  }
};
