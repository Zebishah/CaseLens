import { describe, expect, test } from '@jest/globals';
import { actorInputSchema } from '../../../src/integrations/apify/actor-input.schema.js';
import { safeActorErrorDetails } from '../../../src/actor/safe-actor-error.js';

describe('safe Actor failure details', () => {
  test('logs only sanitized Zod issue path, code, and message', () => {
    const result = actorInputSchema.safeParse({
      type: 'intelligence',
      conversationId: 'sensitive-conversation-body',
      intercomId: '215475977947017',
    });
    if (result.success) throw new Error('Test input should be invalid.');

    const details = safeActorErrorDetails(result.error);

    expect(details).toEqual({
      errorType: 'ZodError',
      validationIssues: [
        {
          path: ['conversationId'],
          code: 'invalid_type',
          message: 'Expected number, received string',
        },
      ],
    });
    expect(JSON.stringify(details)).not.toContain('sensitive-conversation-body');
    expect(JSON.stringify(details)).not.toContain('215475977947017');
  });
});
