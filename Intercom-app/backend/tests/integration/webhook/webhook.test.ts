import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { computeWebhookSignature } from '../../../src/modules/intercom/intercom.signature.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/intercom');
const TEST_SECRET = process.env.INTERCOM_CLIENT_SECRET ?? 'test-intercom-client-secret';

/** Raw bytes Intercom signs; supertest must send the string form (not Buffer — it JSON-serializes buffers). */
const loadWebhookFixture = (): { rawBody: Buffer; payload: string } => {
  const payload = readFileSync(path.join(fixturesDir, 'webhook.conversation.created.json'), 'utf8');
  return { rawBody: Buffer.from(payload), payload };
};

const mockSyncFromWebhook = jest.fn<
  () => Promise<{ id: number; intercomId: string; reporterName: string | null; intelligenceStatus: string }>
>();
const mockRefreshFromIntercomApi = jest.fn<
  () => Promise<{ record: { id: number; intercomId: string; intelligenceStatus: string }; subjectChanged: boolean }>
>();
const mockMarkIntelligencePending = jest.fn<() => Promise<void>>();
const mockEnqueueIntercomIntelligence = jest.fn<() => Promise<void>>();
const mockRecordIntercomNotification = jest.fn<
  () => Promise<{
    duplicate: boolean;
    externalEventId: string;
    inboundEventId?: number | null;
    status?: string;
  }>
>();
const mockMarkInboundQueued = jest.fn<() => Promise<void>>();
const mockFindOutbox = jest.fn<() => Promise<unknown>>();
const mockInsertOutbox = jest.fn<() => Promise<{ id: number; status: string }>>();
const mockMarkOutboxDispatched = jest.fn<() => Promise<void>>();
const mockFindById = jest.fn<
  () => Promise<
    | {
        id: number;
        intercomId: string;
        intelligenceStatus: string;
        intelligenceSnapshot: null;
      }
    | undefined
  >
>();
const mockCountMessages = jest.fn<() => Promise<number>>();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.service.js', () => ({
  conversationService: {
    syncFromWebhook: mockSyncFromWebhook,
    refreshFromIntercomApi: mockRefreshFromIntercomApi
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    markIntelligencePending: mockMarkIntelligencePending,
    findById: mockFindById,
    countMessagesByConversationId: mockCountMessages
  }
}));

await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueueIntercomIntelligence,
  enqueueIntelligenceForConversation: mockEnqueueIntercomIntelligence,
  enqueuePeerSnapshotRefreshJob: jest.fn(async () => undefined)
}));

await jest.unstable_mockModule('../../../src/modules/ingestion/intercom.webhook.adapter.js', () => ({
  recordIntercomWebhookNotification: mockRecordIntercomNotification
}));

await jest.unstable_mockModule('../../../src/modules/ingestion/ingestion.repository.js', () => ({
  ingestionRepository: {
    markQueued: mockMarkInboundQueued,
    findOutboxForEvent: mockFindOutbox,
    insertOutbox: mockInsertOutbox,
    markDispatched: mockMarkOutboxDispatched
  }
}));

const { app } = await import('../../../src/app.js');

describe('Intercom webhook integration', () => {
  beforeEach(() => {
    mockSyncFromWebhook.mockReset();
    mockRefreshFromIntercomApi.mockReset();
    mockMarkIntelligencePending.mockReset();
    mockEnqueueIntercomIntelligence.mockReset();
    mockRecordIntercomNotification.mockReset();
    mockMarkInboundQueued.mockReset();
    mockFindOutbox.mockReset();
    mockInsertOutbox.mockReset();
    mockMarkOutboxDispatched.mockReset();
    mockMarkInboundQueued.mockResolvedValue(undefined);
    mockFindOutbox.mockResolvedValue(undefined);
    mockInsertOutbox.mockResolvedValue({ id: 90, status: 'pending' });
    mockMarkOutboxDispatched.mockResolvedValue(undefined);
    mockRecordIntercomNotification.mockResolvedValue({
      duplicate: false,
      externalEventId: 'notif-1',
      inboundEventId: 90,
      status: 'received'
    });
    mockSyncFromWebhook.mockResolvedValue({
      id: 1,
      intercomId: '123456789',
      reporterName: 'Jon Fritz',
      intelligenceStatus: 'pending'
    });
    mockRefreshFromIntercomApi.mockResolvedValue({
      subjectChanged: false,
      record: {
        id: 1,
        intercomId: '123456789',
        intelligenceStatus: 'ready'
      }
    });
    mockFindById.mockResolvedValue({
      id: 1,
      intercomId: '123456789',
      intelligenceStatus: 'pending',
      intelligenceSnapshot: null,
      intercomSourceUpdatedAt: new Date('2026-09-01T00:00:00.000Z')
    });
    mockCountMessages.mockResolvedValue(1);
    mockMarkIntelligencePending.mockResolvedValue(undefined);
    mockEnqueueIntercomIntelligence.mockResolvedValue(undefined);
  });

  test('POST /webhooks/intercom - rejects missing signature', async () => {
    const { payload } = loadWebhookFixture();
    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(mockSyncFromWebhook).not.toHaveBeenCalled();
  });

  test('POST /webhooks/intercom - rejects invalid signature', async () => {
    const { payload } = loadWebhookFixture();
    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', 'sha1=invalidsignature00000000000000000000000000')
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(mockSyncFromWebhook).not.toHaveBeenCalled();
  });

  test('POST /webhooks/intercom - accepts valid signature and syncs conversation', async () => {
    const { rawBody, payload } = loadWebhookFixture();
    const signature = computeWebhookSignature(rawBody, TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(mockRecordIntercomNotification).toHaveBeenCalledTimes(1);
    expect(mockSyncFromWebhook).toHaveBeenCalledTimes(1);
    expect(mockEnqueueIntercomIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 1,
        intercomId: '123456789',
        skipSync: true,
        sourceRevision: expect.any(String)
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^intelligence-1-r/)
      })
    );
    expect(mockInsertOutbox).toHaveBeenCalledWith(expect.objectContaining({
      inboundEventId: expect.any(Number),
      jobName: 'process-intelligence',
      status: 'pending'
    }));
    expect(mockMarkOutboxDispatched).toHaveBeenCalledWith(90);
  });

  test('POST /webhooks/intercom - resumes a recorded event that was never queued', async () => {
    mockRecordIntercomNotification.mockResolvedValue({
      duplicate: true,
      externalEventId: 'notif-interrupted',
      inboundEventId: 44,
      status: 'received'
    });
    const { rawBody, payload } = loadWebhookFixture();
    const signature = computeWebhookSignature(rawBody, TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(mockSyncFromWebhook).toHaveBeenCalledTimes(1);
    expect(mockEnqueueIntercomIntelligence).toHaveBeenCalledTimes(1);
    expect(mockMarkInboundQueued).toHaveBeenCalledWith(44, 1);
  });

  test('POST /webhooks/intercom - duplicate notification does not re-sync', async () => {
    mockRecordIntercomNotification.mockResolvedValue({ duplicate: true, externalEventId: 'notif-1' });
    const { rawBody, payload } = loadWebhookFixture();
    const signature = computeWebhookSignature(rawBody, TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(mockSyncFromWebhook).not.toHaveBeenCalled();
    expect(mockEnqueueIntercomIntelligence).not.toHaveBeenCalled();
  });

  test('HEAD /webhooks/intercom - Intercom URL validation', async () => {
    const res = await request(app as Express).head('/webhooks/intercom');
    expect(res.statusCode).toBe(200);
  });

  test('POST /webhooks/intercom - rejects workspace mismatch', async () => {
    const payload = JSON.stringify({
      type: 'notification_event',
      topic: 'conversation.user.created',
      id: 'notif-mismatch',
      app_id: 'other-workspace',
      data: { item: { id: '123456789' } }
    });
    const signature = computeWebhookSignature(Buffer.from(payload), TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(mockRecordIntercomNotification).not.toHaveBeenCalled();
    expect(mockSyncFromWebhook).not.toHaveBeenCalled();
  });

  test('POST /webhooks/intercom - ignores conversation.admin.noted', async () => {
    const payload = JSON.stringify({
      type: 'notification_event',
      topic: 'conversation.admin.noted',
      id: 'notif-note',
      app_id: 'test-workspace-id',
      data: { item: { id: '123456789' } }
    });
    const signature = computeWebhookSignature(Buffer.from(payload), TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(mockRecordIntercomNotification).not.toHaveBeenCalled();
    expect(mockSyncFromWebhook).not.toHaveBeenCalled();
    expect(mockEnqueueIntercomIntelligence).not.toHaveBeenCalled();
  });

  test('POST /webhooks/intercom - a later user reply enqueues a different revision job id', async () => {
    mockCountMessages.mockResolvedValue(2);
    mockFindById.mockResolvedValue({
      id: 1,
      intercomId: '123456789',
      intelligenceStatus: 'ready',
      intelligenceSnapshot: {
        employeeMatches: [],
        relatedCases: [],
        messageCount: 1,
        processedAt: '2026-09-01T00:00:00.000Z',
        sourceRevision: '2026-09-01T00:00:00.000Z'
      },
      intercomSourceUpdatedAt: new Date('2026-09-01T01:00:00.000Z')
    });

    const payload = JSON.stringify({
      type: 'notification_event',
      topic: 'conversation.user.replied',
      id: 'notif-reply-2',
      app_id: 'test-workspace-id',
      data: { item: { id: '123456789' } }
    });
    const signature = computeWebhookSignature(Buffer.from(payload), TEST_SECRET);

    const res = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', signature)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(mockRefreshFromIntercomApi).toHaveBeenCalledTimes(1);
    expect(mockEnqueueIntercomIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 1,
        sourceRevision: `2-${new Date('2026-09-01T01:00:00.000Z').getTime()}`
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^intelligence-1-r/)
      })
    );
  });
});
