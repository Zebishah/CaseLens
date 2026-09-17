import { Actor } from 'apify';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { writeActorOutput } from '../../../src/actor/actor.output.js';
import { safeActorErrorDetails } from '../../../src/actor/safe-actor-error.js';

const actorSetValue = jest.spyOn(Actor, 'setValue');

afterEach(() => {
  actorSetValue.mockReset();
});

describe('Actor output writing', () => {
  test('writes the safe output metadata to the default key-value store', async () => {
    const output = {
      type: 'intelligence',
      status: 'completed',
      durationMs: 125,
      conversationId: 12,
    };
    actorSetValue.mockResolvedValue(undefined);

    await expect(writeActorOutput(output)).resolves.toBeUndefined();

    expect(actorSetValue).toHaveBeenCalledWith('OUTPUT', output);
  });

  test('propagates output write errors with only safe diagnostics available', async () => {
    const output = { type: 'intelligence', status: 'completed', durationMs: 1 };
    const error = Object.assign(
      new Error('request failed using secret-token-value'),
      { name: 'ApifyApiError', statusCode: 403 },
    );
    actorSetValue.mockRejectedValue(error);

    await expect(writeActorOutput(output)).rejects.toBe(error);

    const diagnostics = safeActorErrorDetails(error);
    expect(diagnostics).toEqual({
      errorType: 'ApifyApiError',
      errorCode: 'HTTP_403',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('secret-token-value');
    expect(JSON.stringify(diagnostics)).not.toContain('request failed');
  });
});
