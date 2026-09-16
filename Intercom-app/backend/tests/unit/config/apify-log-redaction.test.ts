import { describe, expect, test } from '@jest/globals';
import { redactApifyLogMetadata } from '../../../src/config/apify-log-redaction.util.js';

describe('Apify log privacy', () => {
  test('retains safe operational IDs and removes employee and case details recursively', () => {
    const safe = redactApifyLogMetadata({
      level: 'info',
      message: '[actor] completed',
      conversationId: 12,
      intercomId: 'ic-12',
      sourceRevision: '4-9',
      reporterName: 'Employee Name',
      subject: 'Private subject',
      extractedNames: ['Employee Name'],
      details: { body: 'Private body', email: 'private@example.com' }
    });
    expect(safe).toMatchObject({ conversationId: 12, intercomId: 'ic-12', sourceRevision: '4-9' });
    expect(safe.reporterName).toBe('[redacted]');
    expect(safe.subject).toBe('[redacted]');
    expect(safe.extractedNames).toBe('[redacted]');
    expect(safe.details).toEqual({ body: '[redacted]', email: '[redacted]' });
    expect(JSON.stringify(safe)).not.toContain('Employee Name');
    expect(JSON.stringify(safe)).not.toContain('Private body');
  });
});
