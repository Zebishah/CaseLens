import { describe, expect, test, jest } from '@jest/globals';
import { ApifyClientError, createApifyClient } from '../../../src/integrations/apify/apify.client.js';

const response = (status: number, body?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as Response;

const makeClient = (fetchImpl: typeof fetch, requestTimeoutMs = 100): ReturnType<typeof createApifyClient> =>
  createApifyClient({
    token: 'secret-hr-token',
    actorId: 'owner~hr-intelligence-worker',
    baseUrl: 'https://api.apify.com/v2',
    requestTimeoutMs,
    memoryMbytes: 512,
    runTimeoutSeconds: 180,
    fetchImpl
  });

describe('Apify client', () => {
  test('starts an Actor run asynchronously with a bearer token and resource limits', async () => {
    const fetchImpl = jest.fn(async () => response(201, { data: { id: 'run-123', status: 'READY' } })) as unknown as typeof fetch;
    const result = await makeClient(fetchImpl).startActorRun({ type: 'intelligence', conversationId: 4 });
    expect(result).toEqual({ id: 'run-123', status: 'READY' });
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/acts/owner~hr-intelligence-worker/runs?memory=512&timeout=180');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-hr-token');
  });

  test.each([
    [401, 'credential_error'],
    [403, 'credential_error'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [500, 'upstream_unavailable']
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    const fetchImpl = jest.fn(async () => response(status)) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).startActorRun({})).rejects.toMatchObject({ code });
  });

  test('maps request timeout to transport error without exposing the token', async () => {
    const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    try {
      await makeClient(fetchImpl, 1).startActorRun({});
      throw new Error('expected timeout');
    } catch (error) {
      expect(error).toBeInstanceOf(ApifyClientError);
      expect(error).toMatchObject({ code: 'transport_error' });
      expect((error as Error).message).not.toContain('secret-hr-token');
    }
  });

  test('rejects malformed responses as contract errors', async () => {
    const fetchImpl = jest.fn(async () => response(201, { data: { status: 'READY' } })) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).startActorRun({})).rejects.toMatchObject({ code: 'contract_error' });
  });

  test('rejects malformed JSON as a contract error', async () => {
    const malformed = { ok: true, status: 201, json: async () => { throw new Error('bad json'); } } as unknown as Response;
    const fetchImpl = jest.fn(async () => malformed) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).startActorRun({})).rejects.toMatchObject({ code: 'contract_error' });
  });
});
