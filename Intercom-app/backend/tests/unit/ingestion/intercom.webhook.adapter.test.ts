import { describe, expect, test } from '@jest/globals';
import { intercomNotificationId } from '../../../src/modules/ingestion/intercom.webhook.adapter.js';

describe('intercom webhook adapter', () => {
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
