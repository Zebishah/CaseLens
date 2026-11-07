import { jest } from '@jest/globals';
import type { Express } from 'express';
import request from 'supertest';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import {
  computeCanvasSignature,
  computeWebhookSignature
} from '../../../src/modules/intercom/intercom.signature.js';

const TEST_SECRET = process.env.INTERCOM_CLIENT_SECRET ?? 'test-intercom-client-secret';
const INTERCOM_ID = '123456789';

const mockSyncFromWebhook = jest.fn(async () => ({
  id: 1,
  intercomId: INTERCOM_ID,
  reporterName: 'Jordan Hale',
  intelligenceStatus: 'pending'
}));
const mockRefreshFromIntercomApi = jest.fn(async () => ({
  subjectChanged: false,
  record: { id: 1, intercomId: INTERCOM_ID, intelligenceStatus: 'ready' }
}));
const mockEnsureSynced = jest.fn(async () => ({
  subjectChanged: false,
  record: { id: 1, intercomId: INTERCOM_ID, intelligenceStatus: INTELLIGENCE_STATUS.READY }
}));
const mockFindById = jest.fn();
const mockFindByIntercomId = jest.fn();
const mockCountMessages = jest.fn(async () => 1);
const mockEnqueue = jest.fn(async () => undefined);
const mockRecordNotification = jest.fn(async () => ({
  duplicate: false,
  externalEventId: 'notif-1'
}));
const mockBuildLiveCanvasSnapshot = jest.fn(async (conversation: { intelligenceSnapshot?: unknown }) =>
  conversation.intelligenceSnapshot ?? {
    employeeMatches: [],
    relatedCases: [],
    processedAt: new Date().toISOString()
  }
);
const mockEnrichSnapshot = jest.fn(async (_conversation: unknown, snapshot: unknown) => snapshot);
const mockResolveCc = jest.fn(async () => ({
  status: 'ok',
  storeNumber: '1042',
  companyName: 'Northwind',
  recipients: [{ name: 'Pat Quinn', email: 'pat.quinn@northwind.co', role: 'ops', source: 'store' }],
  message: null
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.service.js', () => ({
  conversationService: {
    syncFromWebhook: mockSyncFromWebhook,
    refreshFromIntercomApi: mockRefreshFromIntercomApi,
    ensureSyncedFromIntercomApi: mockEnsureSynced
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    findByIntercomId: mockFindByIntercomId,
    countMessagesByConversationId: mockCountMessages,
    markIntelligencePending: jest.fn(async () => undefined),
    haveConversationsUpdatedSince: jest.fn(async () => false),
    updateIntelligence: jest.fn(async () => undefined),
    updateReporterStoreNumber: jest.fn(async () => undefined),
    dismissRelatedCase: jest.fn(async () => undefined)
  }
}));

await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueue,
  enqueueIntelligenceForConversation: mockEnqueue,
  enqueuePeerSnapshotRefreshJob: jest.fn(async () => undefined)
}));

await jest.unstable_mockModule('../../../src/modules/ingestion/intercom.webhook.adapter.js', () => ({
  recordIntercomWebhookNotification: mockRecordNotification
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.service.js', () => ({
  intelligenceService: {
    buildLiveCanvasSnapshot: mockBuildLiveCanvasSnapshot,
    enrichSnapshotForCanvasDisplay: mockEnrichSnapshot
  }
}));

await jest.unstable_mockModule('../../../src/modules/store-directory/cc-recipients.service.js', () => ({
  ccRecipientsService: {
    resolveForStoreNumber: mockResolveCc
  }
}));

const { app } = await import('../../../src/app.js');

const readyRecord = {
  id: 1,
  intercomId: INTERCOM_ID,
  source: 'intercom',
  intelligenceStatus: INTELLIGENCE_STATUS.READY,
  intelligenceError: null,
  reporterName: 'Store 1042 Manager',
  reporterEmail: '1042@northwind.co',
  reporterStoreNumber: '1042',
  intercomSyncStatus: 'synced',
  intelligenceSnapshot: {
    caseType: 'attendance',
    employeeMatches: [
      {
        employeeIdentityId: 4,
        canonicalName: 'Jordan Hale',
        confidenceScore: 96,
        matchMethod: 'exact'
      }
    ],
    relatedCases: [
      {
        conversationId: 9,
        intercomId: 'rel-9',
        subject: 'Attendance — Jordan Hale',
        caseType: 'attendance',
        matchedEmployeeNames: ['Jordan Hale'],
        reporterName: 'Store 1042 Manager',
        status: 'open',
        advisorName: null,
        createdAt: '2026-08-01T00:00:00.000Z'
      }
    ],
    messageCount: 1,
    processedAt: '2026-09-01T12:00:00.000Z',
    sourceRevision: '2026-09-01T00:00:00.000Z',
    intelligenceVersion: '1:1:1756684800000'
  }
};

describe('Intercom HTTP E2E (Express stack, mocked Intercom/Gemini)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordNotification.mockResolvedValue({ duplicate: false, externalEventId: 'notif-1' });
    mockCountMessages.mockResolvedValue(1);
    mockFindById.mockResolvedValue({
      ...readyRecord,
      intelligenceStatus: 'pending',
      intelligenceSnapshot: null,
      intercomSourceUpdatedAt: new Date('2026-09-01T00:00:00.000Z')
    });
    mockFindByIntercomId.mockResolvedValue(readyRecord);
  });

  it('ingests a signed webhook, coalesces a duplicate, then renders ready Canvas', async () => {
    const created = JSON.stringify({
      type: 'notification_event',
      topic: 'conversation.user.created',
      id: 'notif-e2e-1',
      app_id: 'test-workspace-id',
      data: { item: { id: INTERCOM_ID } }
    });
    const createdSignature = computeWebhookSignature(Buffer.from(created), TEST_SECRET);

    const first = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', createdSignature)
      .send(created);
    expect(first.statusCode).toBe(200);
    expect(mockEnqueue).toHaveBeenCalled();
    const firstJobId = (mockEnqueue.mock.calls[0]?.[1] as { jobId?: string } | undefined)?.jobId;

    mockRecordNotification.mockResolvedValueOnce({ duplicate: true, externalEventId: 'notif-e2e-1' });
    const replay = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', createdSignature)
      .send(created);
    expect(replay.statusCode).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);

    mockCountMessages.mockResolvedValue(2);
    mockFindById.mockResolvedValue({
      ...readyRecord,
      intercomSourceUpdatedAt: new Date('2026-09-01T01:00:00.000Z')
    });
    const reply = JSON.stringify({
      type: 'notification_event',
      topic: 'conversation.user.replied',
      id: 'notif-e2e-2',
      app_id: 'test-workspace-id',
      data: { item: { id: INTERCOM_ID } }
    });
    const replySignature = computeWebhookSignature(Buffer.from(reply), TEST_SECRET);
    const second = await request(app as Express)
      .post('/webhooks/intercom')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature', replySignature)
      .send(reply);
    expect(second.statusCode).toBe(200);
    const replyJobId = (mockEnqueue.mock.calls[1]?.[1] as { jobId?: string } | undefined)?.jobId;
    expect(replyJobId).toBeDefined();
    expect(replyJobId).not.toBe(firstJobId);

    const canvasBody = {
      workspace_id: 'test-workspace-id',
      conversation_id: INTERCOM_ID
    };
    const canvasSignature = computeCanvasSignature(canvasBody, TEST_SECRET);
    const canvas = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', canvasSignature)
      .send(canvasBody);
    expect(canvas.statusCode).toBe(200);
    expect(canvas.body.canvas.content.components[0].text).toBe('Case Lense');
    expect(JSON.stringify(canvas.body)).toContain('Jordan Hale');

    const configureBody = { component_id: 'configure' };
    const configure = await request(app as Express)
      .post('/canvas/configure')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', computeCanvasSignature(configureBody, TEST_SECRET))
      .send(configureBody);
    expect(configure.statusCode).toBe(200);
  });
});
