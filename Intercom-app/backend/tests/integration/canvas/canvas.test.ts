import { jest } from '@jest/globals';
import type { Express } from 'express';
import request from 'supertest';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import { CANVAS_COPY } from '../../../src/constants/canvas.constants.js';
import { computeCanvasSignature } from '../../../src/modules/intercom/intercom.signature.js';

const TEST_SECRET = process.env.INTERCOM_CLIENT_SECRET ?? 'test-intercom-client-secret';

const mockEnsureSynced = jest.fn<
  () => Promise<{ record: Record<string, unknown>; subjectChanged: boolean }>
>();
const mockFindById = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockFindByIntercomId = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockDismissRelatedCase = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockUpdateIntelligence = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockUpdateReporterStoreNumber = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockCountMessages = jest.fn<() => Promise<number>>();
const mockHaveConversationsUpdatedSince = jest.fn<() => Promise<boolean>>();
const mockMarkIntelligencePending = jest.fn<() => Promise<void>>();
const mockProcessIntelligence = jest.fn<() => Promise<void>>();
const mockRunIntelligenceOnce = jest.fn<() => Promise<void>>();
const mockEnqueueIntelligence = jest.fn<() => Promise<void>>();
const mockResolveForStoreNumber = jest.fn<() => Promise<Record<string, unknown>>>();
const mockBuildLiveCanvasSnapshot = jest.fn<
  (conversation: Record<string, unknown>) => Promise<Record<string, unknown>>
>();
const mockEnrichSnapshotForCanvasDisplay = jest.fn<
  (
    conversation: Record<string, unknown>,
    snapshot: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
>();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.service.js', () => ({
  conversationService: {
    ensureSyncedFromIntercomApi: mockEnsureSynced
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    findByIntercomId: mockFindByIntercomId,
    dismissRelatedCase: mockDismissRelatedCase,
    updateIntelligence: mockUpdateIntelligence,
    updateReporterStoreNumber: mockUpdateReporterStoreNumber,
    countMessagesByConversationId: mockCountMessages,
    haveConversationsUpdatedSince: mockHaveConversationsUpdatedSince,
    markIntelligencePending: mockMarkIntelligencePending
  }
}));

await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueueIntelligence,
  enqueueIntelligenceForConversation: mockEnqueueIntelligence,
  enqueuePeerSnapshotRefreshJob: jest.fn(async () => undefined)
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.processor.js', () => ({
  processIntelligenceForConversation: mockProcessIntelligence
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence-processing.lock.js', () => ({
  runIntelligenceOnce: mockRunIntelligenceOnce
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.service.js', () => ({
  intelligenceService: {
    buildLiveCanvasSnapshot: mockBuildLiveCanvasSnapshot,
    enrichSnapshotForCanvasDisplay: mockEnrichSnapshotForCanvasDisplay
  }
}));

await jest.unstable_mockModule('../../../src/modules/store-directory/cc-recipients.service.js', () => ({
  ccRecipientsService: {
    resolveForStoreNumber: mockResolveForStoreNumber
  }
}));

const { app } = await import('../../../src/app.js');

const signCanvasBody = (body: Record<string, unknown>): string =>
  computeCanvasSignature(body, TEST_SECRET);

describe('Intercom canvas integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);
    mockEnqueueIntelligence.mockResolvedValue(undefined);
    mockUpdateIntelligence.mockResolvedValue(undefined);
    mockMarkIntelligencePending.mockResolvedValue(undefined);
    mockProcessIntelligence.mockResolvedValue(undefined);
    mockRunIntelligenceOnce.mockResolvedValue(undefined);
    mockBuildLiveCanvasSnapshot.mockImplementation(async (conversation) => {
      const snapshot = conversation.intelligenceSnapshot as Record<string, unknown> | null;

      return {
        employeeMatches: snapshot?.employeeMatches ?? [],
        relatedCases: snapshot?.relatedCases ?? [],
        possibleSamePerson: snapshot?.possibleSamePerson ?? [],
        processedAt: snapshot?.processedAt ?? new Date().toISOString()
      };
    });
    mockEnrichSnapshotForCanvasDisplay.mockImplementation(
      async (_conversation, snapshot) => snapshot
    );
    mockResolveForStoreNumber.mockResolvedValue({
      status: 'no_store',
      storeNumber: null,
      companyName: null,
      recipients: [],
      message: CANVAS_COPY.CC_NO_STORE
    });
    mockUpdateReporterStoreNumber.mockResolvedValue(undefined);
  });

  test('POST /canvas/initialize - rejects missing signature', async () => {
    const body = { conversation_id: '215474611248560' };

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.statusCode).toBe(401);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
  });

  test('POST /canvas/initialize - accepts inbox payload with conversation.id', async () => {
    const body = {
      workspace_id: 'test-workspace-id',
      admin: { id: '1', name: 'HR Bot' },
      conversation: { type: 'conversation', id: '215474091120045', title: 'employee issue' }
    };
    const signature = signCanvasBody(body);

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: {
      id: 2,
      intercomId: '215474091120045',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        messageCount: 1,
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    }
    });
    mockFindByIntercomId.mockResolvedValue({
      id: 2,
      intercomId: '215474091120045',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        messageCount: 1,
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', style: 'header', text: 'HR Intelligence' })
      ])
    );
    expect(res.body.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATES_PENDING })
      ])
    );
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockProcessIntelligence).not.toHaveBeenCalled();
  });

  test('POST /canvas/initialize - returns ready intelligence snapshot', async () => {
    const body = { conversation_id: '215474611248560', admin_id: '1' };
    const signature = signCanvasBody(body);

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: {
      id: 6,
      intercomId: '215474611248560',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [
          {
            conversationId: 2,
            intercomId: '215474091120045',
            subject: 'employee issue',
            caseType: 'general',
            matchedEmployeeNames: ['Mohammad Nehaal'],
            reporterName: 'Jon Fritz',
            status: 'open',
            advisorName: 'Crystal',
            createdAt: '2026-04-28T10:00:00.000Z'
          }
        ],
        messageCount: 1,
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    }
    });
    mockFindByIntercomId.mockResolvedValue({
      id: 6,
      intercomId: '215474611248560',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [
          {
            conversationId: 2,
            intercomId: '215474091120045',
            subject: 'employee issue',
            caseType: 'general',
            matchedEmployeeNames: ['Mohammad Nehaal'],
            reporterName: 'Jon Fritz',
            status: 'open',
            advisorName: 'Crystal',
            createdAt: '2026-04-28T10:00:00.000Z'
          }
        ],
        messageCount: 1,
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      canvas: {
        content: {
          components: expect.any(Array)
        }
      }
    });
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', style: 'header', text: 'HR Intelligence' }),
        expect.objectContaining({ type: 'list' })
      ])
    );
    expect(mockBuildLiveCanvasSnapshot).not.toHaveBeenCalled();
    expect(mockEnsureSynced).not.toHaveBeenCalled();
  });

  test('POST /canvas/initialize - syncs when conversation is missing from DB', async () => {
    const body = { conversation_id: '999' };
    const signature = signCanvasBody(body);

    mockFindByIntercomId.mockResolvedValue(undefined);
    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: {
      id: 9,
      intercomId: '999',
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      intelligenceSnapshot: null,
      intelligenceError: null,
      updatedAt: new Date()
    }
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).toHaveBeenCalledWith('999', { enqueue: false });
    expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, intercomId: '999' }),
      expect.objectContaining({ messageCount: 1, skipSync: true })
    );
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.PROCESSING_DETAIL })
      ])
    );
  });

  test('POST /canvas/initialize - returns pending without duplicate enqueue when webhook is processing', async () => {
    const body = { conversation_id: '999' };
    const signature = signCanvasBody(body);

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: {
      id: 9,
      intercomId: '999',
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      intelligenceSnapshot: null,
      intelligenceError: null,
      updatedAt: new Date()
    }
    });
    mockFindByIntercomId.mockResolvedValue({
      id: 9,
      intercomId: '999',
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      intelligenceSnapshot: null,
      intelligenceError: null,
      updatedAt: new Date()
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockEnqueueIntelligence).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', style: 'header', text: 'HR Intelligence' }),
        expect.objectContaining({ text: CANVAS_COPY.PROCESSING_DETAIL }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: 'Refresh results'
        })
      ])
    );
  });

  test('POST /canvas/initialize - shows refresh prompt when live Intercom subject differs from processed subject', async () => {
    const body = {
      conversation_id: '215474884548358',
      admin_id: '1',
      conversation: {
        type: 'conversation',
        id: '215474884548358',
        title: 'Attendance issue - ahsan',
        custom_attributes: { Subject: 'Attendance issue - ahsan' }
      }
    };
    const signature = signCanvasBody(body);

    mockFindByIntercomId.mockResolvedValue({
      id: 656,
      intercomId: '215474884548358',
      subject: 'Attendance issue - zubair',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'zebi shah',
            confidenceScore: 100,
            matchMethod: 'alias'
          }
        ],
        relatedCases: [],
        mentionedInReport: ['zubi shah'],
        messageCount: 1,
        processedSubject: 'Attendance issue - zubair',
        extractionSource: 'gemini',
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockCountMessages.mockResolvedValue(1);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATES_PENDING }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: CANVAS_COPY.REFRESH_RESULTS
        })
      ])
    );
  });

  test('POST /canvas/initialize - does not sync from Intercom when cached snapshot exists', async () => {
    const body = { conversation_id: '215474884548358', admin_id: '1' };
    const signature = signCanvasBody(body);

    mockFindByIntercomId.mockResolvedValue({
      id: 656,
      intercomId: '215474884548358',
      subject: 'Attendance issue - ahsan',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'zebi shah',
            confidenceScore: 100,
            matchMethod: 'alias'
          }
        ],
        relatedCases: [],
        mentionedInReport: ['zubi shah'],
        messageCount: 1,
        processedSubject: 'Attendance issue - zubair',
        extractionSource: 'gemini',
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockCountMessages.mockResolvedValue(1);

    const res = await request(app as Express)
      .post('/canvas/initialize')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockRunIntelligenceOnce).not.toHaveBeenCalled();
    expect(mockEnqueueIntelligence).not.toHaveBeenCalled();
    expect(mockEnrichSnapshotForCanvasDisplay).not.toHaveBeenCalled();
    expect(mockCountMessages).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATES_PENDING })
      ])
    );
  });

  test('POST /canvas/submit - refresh syncs from Intercom and reprocesses when subject changed', async () => {
    const body = {
      conversation_id: '215474884548358',
      component_id: 'refresh-intelligence'
    };
    const signature = signCanvasBody(body);

    let intelligenceSnapshot: Record<string, unknown> = {
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'zebi shah',
          confidenceScore: 100,
          matchMethod: 'alias'
        }
      ],
      relatedCases: [],
      mentionedInReport: ['zubi shah'],
      messageCount: 1,
      processedSubject: 'Attendance issue - zubair',
      extractionSource: 'gemini',
      processedAt: '2026-06-08T09:18:38.025Z'
    };

    const conversationBase = {
      id: 656,
      intercomId: '215474884548358',
      subject: 'Attendance issue - ahsan',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null
    };

    mockFindByIntercomId.mockImplementation(async () => ({
      ...conversationBase,
      intelligenceSnapshot
    }));

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: true,
      record: {
        ...conversationBase,
        intelligenceSnapshot
      }
    });

    mockEnqueueIntelligence.mockImplementation(async () => {
      intelligenceSnapshot = {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Ahsan',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        mentionedInReport: ['Ahsan'],
        messageCount: 1,
        processedSubject: 'Attendance issue - ahsan',
        extractionSource: 'gemini',
        processedAt: '2026-06-08T10:18:38.025Z'
      };
    });

    mockCountMessages.mockResolvedValue(1);

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({ id: 656, intercomId: '215474884548358' }),
      expect.objectContaining({
        skipSync: true,
        forceReprocess: true,
        skipPeerRefresh: true
      })
    );
    expect(mockRunIntelligenceOnce).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.RESULTS_UPDATED })
      ])
    );
  });

  test('POST /canvas/submit - refresh shows ready results without reprocess when snapshot is current', async () => {
    const body = {
      conversation_id: '999',
      component_id: 'refresh-intelligence'
    };
    const signature = signCanvasBody(body);

    const readyConversation = {
      id: 9,
      intercomId: '999',
      subject: 'Attendance issue',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Jonathan Fritsch',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        messageCount: 1,
        processedSubject: 'Attendance issue',
        processedAt: '2026-06-15T14:35:54.000Z'
      }
    };

    mockFindByIntercomId.mockResolvedValue(readyConversation);

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: readyConversation
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockEnqueueIntelligence).not.toHaveBeenCalled();
    expect(mockRunIntelligenceOnce).not.toHaveBeenCalled();
    expect(mockBuildLiveCanvasSnapshot).not.toHaveBeenCalled();
    expect(mockEnrichSnapshotForCanvasDisplay).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.EMPLOYEE_MATCH_HEADER }),
        expect.objectContaining({
          type: 'list',
          items: expect.arrayContaining([
            expect.objectContaining({ title: 'Jonathan Fritsch' })
          ])
        }),
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.RESULTS_UPDATED })
      ])
    );
    expect(res.body.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATING_INTELLIGENCE })
      ])
    );
  });

  test('POST /canvas/submit - re-analyze always enqueues force reprocess even when snapshot is current', async () => {
    const body = {
      conversation_id: '999',
      component_id: 'reanalyze-intelligence'
    };
    const signature = signCanvasBody(body);

    let intelligenceSnapshot: Record<string, unknown> = {
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Jonathan Fritsch',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      relatedCases: [],
      messageCount: 1,
      processedSubject: 'Attendance issue',
      processedAt: '2026-06-15T14:35:54.000Z'
    };

    const readyConversation = {
      id: 9,
      intercomId: '999',
      subject: 'Attendance issue',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot
    };

    mockFindByIntercomId.mockImplementation(async () => ({
      ...readyConversation,
      intelligenceSnapshot
    }));
    mockFindById.mockImplementation(async () => ({
      ...readyConversation,
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      intelligenceSnapshot
    }));

    mockEnsureSynced.mockResolvedValue({
      subjectChanged: false,
      record: {
        ...readyConversation,
        intelligenceSnapshot
      }
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);
    mockMarkIntelligencePending.mockResolvedValue(undefined);

    mockEnqueueIntelligence.mockImplementation(async () => {
      intelligenceSnapshot = {
        ...intelligenceSnapshot,
        processedAt: '2026-06-15T14:40:00.000Z',
        relatedCases: [
          {
            conversationId: 2,
            intercomId: 'related-1',
            subject: 'another attendance',
            caseType: 'attendance',
            matchedEmployeeNames: ['Jonathan Fritsch'],
            reporterName: 'Rep',
            status: 'open',
            advisorName: null,
            createdAt: '2026-06-01T00:00:00.000Z'
          }
        ]
      };
    });

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, intercomId: '999' }),
      expect.objectContaining({
        skipSync: true,
        forceReprocess: true,
        skipPeerRefresh: true
      })
    );
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.RESULTS_UPDATED })
      ])
    );
  });

  test('POST /canvas/submit - legacy company domain search button does not enqueue domain search', async () => {
    const body = {
      conversation_id: '215474611248560',
      component_id: 'search-company-domain'
    };
    const signature = signCanvasBody(body);

    mockFindByIntercomId.mockResolvedValue({
      id: 6,
      intercomId: '215474611248560',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      reporterName: 'Store Reporter',
      caseType: 'attendance',
      subject: 'Attendance issue',
      rawPayload: null,
      intelligenceSnapshot: {
        employeeMatches: [],
        relatedCases: [],
        processedAt: '2026-06-24T10:00:00.000Z'
      }
    });
    mockCountMessages.mockResolvedValue(1);
    mockHaveConversationsUpdatedSince.mockResolvedValue(false);

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockEnqueueIntelligence).not.toHaveBeenCalledWith(
      expect.objectContaining({ forceDomainEmployeeSearch: true })
    );
    expect(res.body.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'search-company-domain' })
      ])
    );
  });

  test('POST /canvas/submit - dismisses a related case for the current conversation only', async () => {
    const body = {
      conversation_id: '215474611248560',
      component_id: 'dismiss-related-215474091120045'
    };
    const signature = signCanvasBody(body);

    mockFindByIntercomId.mockResolvedValue({
      id: 6,
      intercomId: '215474611248560',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [
          {
            conversationId: 2,
            intercomId: '215474091120045',
            subject: 'employee issue',
            caseType: 'general',
            matchedEmployeeNames: ['Mohammad Nehaal'],
            reporterName: 'Jon Fritz',
            status: 'open',
            advisorName: 'Crystal',
            createdAt: '2026-04-28T10:00:00.000Z'
          }
        ],
        dismissedRelatedCaseIntercomIds: ['215474091120045'],
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockDismissRelatedCase.mockResolvedValue({
      id: 6,
      intercomId: '215474611248560',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Mohammad Nehaal',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [
          {
            conversationId: 2,
            intercomId: '215474091120045',
            subject: 'employee issue',
            caseType: 'general',
            matchedEmployeeNames: ['Mohammad Nehaal'],
            reporterName: 'Jon Fritz',
            status: 'open',
            advisorName: 'Crystal',
            createdAt: '2026-04-28T10:00:00.000Z'
          }
        ],
        dismissedRelatedCaseIntercomIds: ['215474091120045'],
        processedAt: '2026-06-08T09:18:38.025Z'
      }
    });
    mockBuildLiveCanvasSnapshot.mockResolvedValue({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Mohammad Nehaal',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      relatedCases: [],
      dismissedRelatedCaseIntercomIds: ['215474091120045'],
      processedAt: '2026-06-08T09:18:38.025Z'
    });

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockDismissRelatedCase).toHaveBeenCalledWith(6, '215474091120045');
    expect(mockEnsureSynced).not.toHaveBeenCalled();
    expect(mockBuildLiveCanvasSnapshot).not.toHaveBeenCalled();
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: CANVAS_COPY.NO_RELATED_CASES })
      ])
    );
  });

  test('POST /canvas/submit - saves manual store number and shows CC recipients from directory', async () => {
    const body = {
      conversation_id: '215474611248560',
      component_id: 'submit-manual-store-number',
      input_values: {
        'manual-store-number': '78'
      }
    };
    const signature = signCanvasBody(body);

    const baseConversation = {
      id: 6,
      intercomId: '215474611248560',
      reporterEmail: 'hr@northwind.co',
      reporterStoreNumber: null,
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceError: null,
      intelligenceSnapshot: {
        employeeMatches: [],
        relatedCases: [],
        processedAt: '2026-06-08T09:18:38.025Z',
        ccRecipients: {
          status: 'no_store',
          storeNumber: null,
          companyName: null,
          recipients: [],
          message: CANVAS_COPY.CC_NO_STORE
        }
      }
    };

    mockFindByIntercomId.mockResolvedValue(baseConversation);
    mockUpdateReporterStoreNumber.mockResolvedValue({
      ...baseConversation,
      reporterStoreNumber: '78'
    });
    mockResolveForStoreNumber.mockResolvedValue({
      status: 'ok',
      storeNumber: '78',
      companyName: 'Northwind Bakery',
      recipients: [
        {
          name: 'Pat Ventura',
          email: 'pat.quinn@northwind.co',
          role: 'VP of Ops',
          source: 'store'
        }
      ],
      message: null
    });
    mockUpdateIntelligence.mockResolvedValue({
      ...baseConversation,
      reporterStoreNumber: '78',
      intelligenceSnapshot: {
        ...baseConversation.intelligenceSnapshot,
        ccRecipients: {
          status: 'ok',
          storeNumber: '78',
          companyName: 'Northwind Bakery',
          recipients: [
            {
              name: 'Pat Ventura',
              email: 'pat.quinn@northwind.co',
              role: 'VP of Ops',
              source: 'store'
            }
          ],
          message: null
        }
      }
    });

    const res = await request(app as Express)
      .post('/canvas/submit')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(mockUpdateReporterStoreNumber).toHaveBeenCalledWith(6, '78');
    expect(mockResolveForStoreNumber).toHaveBeenCalledWith('78', 'hr@northwind.co');
    expect(res.body.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.CC_RECIPIENTS_HEADER }),
        expect.objectContaining({
          type: 'list',
          items: expect.arrayContaining([
            expect.objectContaining({
              title: 'Pat Ventura (VP of Ops)',
              subtitle: 'pat.quinn@northwind.co'
            })
          ])
        })
      ])
    );
  });

  test('POST /canvas/configure - returns confirmation canvas', async () => {
    const body = { admin_id: '1' };
    const signature = signCanvasBody(body);

    const res = await request(app as Express)
      .post('/canvas/configure')
      .set('Content-Type', 'application/json')
      .set('x-body-signature', signature)
      .send(body);

    expect(res.statusCode).toBe(200);
    expect(res.body.canvas.content.components[0]).toMatchObject({
      type: 'text',
      style: 'header',
      text: 'HR Intelligence'
    });
  });
});
