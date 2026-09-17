import { Actor } from 'apify';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { loadActorInput } from '../../../src/actor/actor.input.js';

const actorGetInput = jest.spyOn(Actor, 'getInput');

afterEach(() => {
  actorGetInput.mockReset();
});

describe('Actor input loading', () => {
  test('loads the exact intelligence input supplied by the API', async () => {
    const input = {
      type: 'intelligence',
      conversationId: 115,
      intercomId: '215475977947017',
      sourceRevision: 'smoke-test-2026-09-17-03',
      skipSync: true,
      forceReprocess: true,
      skipPeerRefresh: true,
    };
    actorGetInput.mockResolvedValue(input as never);

    await expect(loadActorInput()).resolves.toEqual(input);
    expect(actorGetInput).toHaveBeenCalledTimes(1);
  });

  test('loads and validates a valid intelligence input', async () => {
    actorGetInput.mockResolvedValue({
      type: 'intelligence',
      conversationId: 12,
      intercomId: 'ic-123',
      sourceRevision: '7-42',
    } as never);

    await expect(loadActorInput()).resolves.toMatchObject({
      type: 'intelligence',
      conversationId: 12,
      intercomId: 'ic-123',
      sourceRevision: '7-42',
      skipSync: false,
      forceReprocess: false,
      skipPeerRefresh: false,
    });
    expect(actorGetInput).toHaveBeenCalledTimes(1);
  });

  test('rejects missing input with a safe error', async () => {
    actorGetInput.mockResolvedValue(null as never);

    await expect(loadActorInput()).rejects.toThrow('Actor input is missing.');
  });

  test('rejects invalid input with strict Zod validation', async () => {
    actorGetInput.mockResolvedValue({
      type: 'intelligence',
      conversationId: 12,
      intercomId: 'ic-123',
      privateBody: 'must not be logged',
    } as never);

    await expect(loadActorInput()).rejects.toMatchObject({ name: 'ZodError' });
  });

  test('loads the value through the Apify SDK input API', async () => {
    actorGetInput.mockResolvedValue({
      type: 'recover-pending-outbox',
      limit: 20,
    } as never);

    await expect(loadActorInput()).resolves.toEqual({
      type: 'recover-pending-outbox',
      limit: 20,
    });
    expect(actorGetInput).toHaveBeenCalledTimes(1);
  });
});
