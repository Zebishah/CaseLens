import { afterAll, describe, expect, test } from '@jest/globals';
import { Writable } from 'node:stream';
import winston from 'winston';

process.env.JOB_PROCESSING_MODE = 'apify';
process.env.APIFY_API_TOKEN = 'unit-scoped-token';
process.env.APIFY_ACTOR_ID = 'owner~hr-intelligence-worker';

const { logger } = await import('../../../src/config/logger.config.js');

describe('Apify logger format', () => {
  const output: string[] = [];

  afterAll(() => {
    logger.close();
  });

  test('redacts private fields and raw error messages from Actor console logs', async () => {
    const consoleTransport = logger.transports.find((transport) => transport instanceof winston.transports.Console);
    if (consoleTransport) logger.remove(consoleTransport);
    const capture = new winston.transports.Stream({
      stream: new Writable({
        write(chunk, _encoding, callback) {
          output.push(String(chunk));
          callback();
        }
      })
    });
    logger.add(capture);
    logger.error('[test] safe operation failed', {
      conversationId: 8,
      reporterName: 'Private Employee',
      message: 'raw provider payload with private text'
    });
    await new Promise((resolve) => setImmediate(resolve));
    logger.remove(capture);
    if (consoleTransport) logger.add(consoleTransport);
    expect(JSON.stringify(output)).not.toContain('Private Employee');
    expect(JSON.stringify(output)).not.toContain('raw provider payload');
    expect(JSON.stringify(output)).toContain('conversationId');
  });
});
