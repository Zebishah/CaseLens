import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { intercomClient } from '../../../src/modules/intercom/intercom.client.js';

describe('intercomClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('getAdmin returns parsed admin', async () => {
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          type: 'admin',
          id: '77',
          name: 'Crystal',
          email: 'crystal@example.com'
        })
      }) as Response) as typeof fetch;

    const admin = await intercomClient.getAdmin('77');

    expect(admin.name).toBe('Crystal');
  });

  it('getConversation throws on 404', async () => {
    global.fetch = (async () =>
      ({
        ok: false,
        status: 404,
        text: async () => 'not found'
      }) as Response) as typeof fetch;

    await expect(intercomClient.getConversation('missing')).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it('retries once on transient fetch failed then succeeds', async () => {
    jest.useFakeTimers();
    let calls = 0;

    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError('fetch failed');
      }

      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          type: 'conversation',
          id: '99',
          title: 'late arrival',
          state: 'open',
          created_at: 1,
          updated_at: 1,
          source: { body: 'hello', author: { type: 'user', id: '1', name: 'Rep' } }
        })
      } as Response;
    }) as typeof fetch;

    const pending = intercomClient.getConversation('99');
    await jest.advanceTimersByTimeAsync(1000);
    const conversation = await pending;

    expect(calls).toBe(2);
    expect(conversation.title).toBe('late arrival');
  });

  it('does not retry on 404', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      return {
        ok: false,
        status: 404,
        text: async () => 'not found'
      } as Response;
    }) as typeof fetch;

    await expect(intercomClient.getConversation('missing')).rejects.toMatchObject({
      statusCode: 404
    });
    expect(calls).toBe(1);
  });

  it('does not retry on 401', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      return {
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () => 'unauthorized'
      } as unknown as Response;
    }) as typeof fetch;

    await expect(intercomClient.getConversation('99')).rejects.toMatchObject({
      statusCode: 401
    });
    expect(calls).toBe(1);
  });

  it('getMe returns non-secret identity fields', async () => {
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
        json: async () => ({
          type: 'admin',
          id: '77',
          name: 'Crystal',
          email: 'crystal@example.com',
          app: { type: 'app', id_code: 'test-workspace-id', name: 'Dev workspace' }
        })
      }) as unknown as Response) as typeof fetch;

    const me = await intercomClient.getMe();
    expect(me.adminId).toBe('77');
    expect(me.appId).toBe('test-workspace-id');
    expect(JSON.stringify(me)).not.toContain('test-intercom-access-token');
  });


  const conversationJson = {
    type: 'conversation',
    id: '99',
    title: 'late arrival',
    state: 'open',
    created_at: 1,
    updated_at: 1,
    source: { body: 'hello', author: { type: 'user', id: '1', name: 'Rep' } },
    conversation_parts: {
      conversation_parts: [{ id: 'note-1', part_type: 'note', body: 'HR Intelligence · sync:abcdef123456' }]
    }
  };

  it('retries on 429 then succeeds', async () => {
    jest.useFakeTimers();
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => '1' },
          text: async () => 'rate limited'
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
        json: async () => conversationJson
      } as unknown as Response;
    }) as typeof fetch;

    const pending = intercomClient.getConversation('99');
    await jest.advanceTimersByTimeAsync(1000);
    const conversation = await pending;
    expect(calls).toBe(2);
    expect(conversation.id).toBe('99');
  });

  it('retries on 5xx then succeeds', async () => {
    jest.useFakeTimers();
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => null },
          text: async () => 'upstream'
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
        json: async () => conversationJson
      } as unknown as Response;
    }) as typeof fetch;

    const pending = intercomClient.getConversation('99');
    await jest.advanceTimersByTimeAsync(1000);
    await pending;
    expect(calls).toBe(2);
  });

  it('retries on timeout then succeeds', async () => {
    jest.useFakeTimers();
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('The operation was aborted');
        error.name = 'TimeoutError';
        throw error;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
        json: async () => conversationJson
      } as unknown as Response;
    }) as typeof fetch;

    const pending = intercomClient.getConversation('99');
    await jest.advanceTimersByTimeAsync(1000);
    await pending;
    expect(calls).toBe(2);
  });

  it('posts an admin note', async () => {
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
        json: async () => conversationJson
      }) as unknown as Response) as typeof fetch;

    const result = await intercomClient.replyWithNote('99', '<p>HR Intelligence</p>');
    expect(result.noteId).toBe('note-1');
  });
});
