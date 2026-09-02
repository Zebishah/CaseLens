import { describe, expect, test } from '@jest/globals';
import {
  buildIdempotencyKey,
  buildSourceExternalId,
  hashIngestionPayload,
  normalizeIngestionEvent,
  sanitizePlainText
} from '../../../src/modules/ingestion/ingestion.normalize.js';
import type { CaseIngestionEvent } from '../../../src/modules/ingestion/ingestion.types.js';

const baseEvent = (): CaseIngestionEvent => ({
  source: 'demo',
  externalEventId: 'evt-1',
  senderEmail: '  Store.Manager@Northwind.co ',
  senderName: '  Alex Rivera  ',
  recipients: ['hr@northwind.co', 'HR@northwind.co'],
  subject: '  Attendance — Jordan Hale  ',
  plainTextContent: '<p>Please review <b>Jordan Hale</b> at store 1042.</p>',
  receivedAt: new Date('2026-09-01T12:00:00.000Z'),
  attachments: [],
  providerMetadata: { scenarioId: 'confident-employee' },
  correlationId: '11111111-1111-1111-1111-111111111111',
  processingMode: 'fixture'
});

describe('ingestion.normalize', () => {
  test('sanitizes HTML to plain text and drops script-like markup', () => {
    expect(sanitizePlainText('<p>Hello<br/>world</p><script>alert(1)</script>')).toContain('Hello');
    expect(sanitizePlainText('<p>Hello<br/>world</p>')).toBe('Hello world');
  });

  test('normalizes emails, recipients, and source-prefixed external ids', () => {
    const event = normalizeIngestionEvent(baseEvent());
    expect(event.senderEmail).toBe('store.manager@northwind.co');
    expect(event.recipients).toEqual(['hr@northwind.co']);
    expect(event.plainTextContent).toContain('Jordan Hale');
    expect(event.subject).toBe('Attendance — Jordan Hale');
    expect(buildSourceExternalId(event.source, event.externalEventId)).toBe('demo:evt-1');
    expect(buildIdempotencyKey('email', 'email_123')).toBe('email:email_123');
  });

  test('stable payload hash ignores recipient order', () => {
    const left = normalizeIngestionEvent({
      ...baseEvent(),
      recipients: ['a@northwind.co', 'b@northwind.co']
    });
    const right = normalizeIngestionEvent({
      ...baseEvent(),
      recipients: ['b@northwind.co', 'a@northwind.co']
    });
    expect(hashIngestionPayload(left)).toBe(hashIngestionPayload(right));
  });

  test('rejects empty content', () => {
    expect(() =>
      normalizeIngestionEvent({
        ...baseEvent(),
        plainTextContent: '   '
      })
    ).toThrow();
  });
});
