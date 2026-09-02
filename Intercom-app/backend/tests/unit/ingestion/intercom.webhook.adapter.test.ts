import { describe, expect, test } from '@jest/globals';
import {
  intercomNotificationId,
  intercomPayloadHash
} from '../../../src/modules/ingestion/intercom.webhook.adapter.js';

describe('intercom webhook adapter', () => {
  test('creates a stable SHA-256 payload hash', () => {
    const envelope = {
      topic: 'conversation.user.created',
      id: 'notif-99',
      data: { item: { id: '123' } }
    };

    expect(intercomPayloadHash(envelope)).toMatch(/^[a-f0-9]{64}$/);
    expect(intercomPayloadHash(envelope)).toBe(intercomPayloadHash(envelope));
    expect(intercomPayloadHash({ ...envelope, id: 'notif-100' })).not.toBe(
      intercomPayloadHash(envelope)
    );
  });

  test('prefers the Intercom notification id', () => {
    expect(
      intercomNotificationId({
        topic: 'conversation.user.created',
        id: 'notif-99',
        data: { item: { id: '123' } }
      })
    ).toBe('notif-99');
  });

  test('falls back to topic plus conversation id', () => {
    expect(
      intercomNotificationId({
        topic: 'conversation.user.created',
        data: { item: { id: '123' } }
      })
    ).toBe('conversation.user.created:123');
  });
});
