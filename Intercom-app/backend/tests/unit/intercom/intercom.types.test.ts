import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCanvasInitialize,
  parseIntercomWebhook
} from '../../../src/modules/intercom/intercom.types.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/intercom');

describe('intercom.types', () => {
  it('parses conversation.created webhook fixture', () => {
    const raw = readFileSync(path.join(fixturesDir, 'webhook.conversation.created.json'), 'utf8');
    const payload = parseIntercomWebhook(JSON.parse(raw));

    expect(payload.topic).toBe('conversation.created');
    expect(payload.data.item).toMatchObject({ id: '123456789' });
  });

  it('parses Intercom ping test notification (id null)', () => {
    const payload = parseIntercomWebhook({
      type: 'notification_event',
      app_id: 'yiaixmn1',
      data: {
        type: 'notification_event_data',
        item: { type: 'ping', message: 'This is a ping notification test message.' }
      },
      id: null,
      topic: 'ping'
    });

    expect(payload.topic).toBe('ping');
    expect(payload.id).toBeNull();
  });

  it('parses canvas initialize payload with top-level conversation_id', () => {
    const payload = parseCanvasInitialize({
      conversation_id: '123',
      admin_id: '456',
      workspace_id: 'ws_1'
    });

    expect(payload.conversation_id).toBe('123');
    expect(payload.admin_id).toBe('456');
  });

  it('parses inbox canvas initialize payload with conversation.id', () => {
    const payload = parseCanvasInitialize({
      workspace_id: 'yiaixmn1',
      admin: {
        type: 'admin',
        id: '10438318',
        name: 'HR Bot'
      },
      conversation: {
        type: 'conversation',
        id: '215474091120045',
        title: 'employee issue'
      }
    });

    expect(payload.conversation_id).toBe('215474091120045');
    expect(payload.admin_id).toBe('10438318');
    expect(payload.workspace_id).toBe('yiaixmn1');
  });

  it('parses messenger-style context.conversation_id', () => {
    const payload = parseCanvasInitialize({
      workspace_id: 'ws_1',
      context: {
        location: 'conversation',
        conversation_id: 215474091120045
      }
    });

    expect(payload.conversation_id).toBe(215474091120045);
  });
});
