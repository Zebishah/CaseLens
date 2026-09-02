import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

describe('PostgresLogTransport', () => {
  beforeEach(() => {
    process.env.TEST_DB_LOG_TRANSPORT = '1';
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.TEST_DB_LOG_TRANSPORT;
  });

  it('persists only error level and ignores warn/info', async () => {
    const insertValues = jest.fn(async () => undefined);
    const insert = jest.fn(() => ({ values: insertValues }));

    await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
      db: { insert }
    }));
    await jest.unstable_mockModule('../../../src/database/schema/app_logs.js', () => ({
      appLogs: { table: 'app_logs' }
    }));

    const { PostgresLogTransport } = await import(
      '../../../src/config/postgres-log.transport.js'
    );

    const transport = new PostgresLogTransport({ level: 'error' });

    await new Promise<void>((resolve) => {
      transport.log({ level: 'info', message: 'routine' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      transport.log({ level: 'warn', message: 'soft warning' }, () => resolve());
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(insert).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      transport.log(
        {
          level: 'error',
          message: 'boom',
          conversationId: 42,
          intercomId: 'abc'
        },
        () => resolve()
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'boom',
        conversationId: '42',
        intercomId: 'abc'
      })
    );
  });

  it('skips noisy transient connection errors', async () => {
    const insertValues = jest.fn(async () => undefined);
    const insert = jest.fn(() => ({ values: insertValues }));

    await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
      db: { insert }
    }));
    await jest.unstable_mockModule('../../../src/database/schema/app_logs.js', () => ({
      appLogs: { table: 'app_logs' }
    }));

    const { PostgresLogTransport } = await import(
      '../../../src/config/postgres-log.transport.js'
    );

    const transport = new PostgresLogTransport({ level: 'error' });

    await new Promise<void>((resolve) => {
      transport.log(
        {
          level: 'error',
          message: '[database] Idle client error — connection discarded, pool will reconnect',
          code: 'ECONNRESET'
        },
        () => resolve()
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(insert).not.toHaveBeenCalled();
  });
});
