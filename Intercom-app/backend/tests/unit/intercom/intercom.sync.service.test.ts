import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildIntercomIntelligenceNote } from '../../../src/modules/intercom/intercom.sync.util.js';
import type { IntelligenceSnapshot } from '../../../src/types/intelligence.types.js';

const mockFindById = jest.fn();
const mockUpdateIntercomSync = jest.fn();
const mockFindNoteIdByMarker = jest.fn();
const mockReplyWithNote = jest.fn();
const mockEnsureConversationTag = jest.fn();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    updateIntercomSync: mockUpdateIntercomSync,
    countMessagesByConversationId: jest.fn(async () => 1)
  }
}));

await jest.unstable_mockModule('../../../src/modules/intercom/intercom.client.js', () => ({
  intercomClient: {
    findNoteIdByMarker: mockFindNoteIdByMarker,
    replyWithNote: mockReplyWithNote,
    ensureConversationTag: mockEnsureConversationTag
  }
}));

const { syncIntercomIntelligence } = await import('../../../src/modules/intercom/intercom.sync.service.js');

const snapshot: IntelligenceSnapshot = {
  employeeMatches: [
    { employeeIdentityId: 1, canonicalName: 'Jordan Hale', confidenceScore: 90, matchMethod: 'exact' }
  ],
  relatedCases: [],
  processedAt: '2026-09-01T00:00:00.000Z',
  caseType: 'attendance',
  requiresManualReview: false,
  ccRecipients: { status: 'ok', storeNumber: '1042', companyName: 'Northwind', recipients: [], message: null }
};

const readyConversation = {
  id: 11,
  source: 'intercom',
  intercomId: '123456',
  reporterStoreNumber: '1042',
  companyName: 'Northwind',
  intelligenceStatus: 'ready',
  intercomSyncStatus: null,
  intercomIntelligenceNoteId: null,
  intercomSyncFingerprint: null,
  intercomSyncTags: null,
  intelligenceSnapshot: snapshot
};

describe('syncIntercomIntelligence', () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockUpdateIntercomSync.mockReset();
    mockFindNoteIdByMarker.mockReset();
    mockReplyWithNote.mockReset();
    mockEnsureConversationTag.mockReset();
    mockUpdateIntercomSync.mockImplementation(async (_id: number, input: { status: string }) => ({
      ...readyConversation,
      intercomSyncStatus: input.status
    }));
  });

  it('skips write-back for demo cases', async () => {
    mockFindById.mockResolvedValue({ ...readyConversation, source: 'demo' });
    const result = await syncIntercomIntelligence(11);
    expect(result.skipped).toBe(true);
    expect(result.status).toBe('skipped');
    expect(mockReplyWithNote).not.toHaveBeenCalled();
  });

  it('skips write-back for email cases when Intercom is enabled', async () => {
    mockFindById.mockResolvedValue({ ...readyConversation, source: 'email' });
    const result = await syncIntercomIntelligence(11);
    expect(result.skipped).toBe(true);
    expect(mockReplyWithNote).not.toHaveBeenCalled();
  });

  it('posts a note and tags on first success', async () => {
    mockFindById.mockResolvedValue(readyConversation);
    mockFindNoteIdByMarker.mockResolvedValue(null);
    mockReplyWithNote.mockResolvedValue({ noteId: 'note-1' });
    mockEnsureConversationTag.mockResolvedValue(undefined);

    const result = await syncIntercomIntelligence(11);

    expect(result.status).toBe('synced');
    expect(mockReplyWithNote).toHaveBeenCalledTimes(1);
    expect(mockEnsureConversationTag).toHaveBeenCalled();
    expect(mockUpdateIntercomSync).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: 'synced', noteId: 'note-1' })
    );
  });

  it('does not duplicate notes when fingerprint already synced', async () => {
    const { fingerprint } = buildIntercomIntelligenceNote(
      { reporterStoreNumber: '1042', companyName: 'Northwind' },
      snapshot
    );
    mockFindById.mockResolvedValue({
      ...readyConversation,
      intercomSyncStatus: 'synced',
      intercomIntelligenceNoteId: 'note-1',
      intercomSyncFingerprint: fingerprint
    });

    const result = await syncIntercomIntelligence(11);
    expect(result.skipped).toBe(true);
    expect(mockReplyWithNote).not.toHaveBeenCalled();
  });

  it('reuses an existing Intercom note marker instead of posting again', async () => {
    mockFindById.mockResolvedValue(readyConversation);
    mockFindNoteIdByMarker.mockResolvedValue('existing-note');
    mockEnsureConversationTag.mockResolvedValue(undefined);

    const result = await syncIntercomIntelligence(11);
    expect(result.status).toBe('synced');
    expect(mockReplyWithNote).not.toHaveBeenCalled();
    expect(mockUpdateIntercomSync).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ noteId: 'existing-note' })
    );
  });

  it('records failed sync without throwing on Intercom 5xx', async () => {
    mockFindById.mockResolvedValue(readyConversation);
    mockFindNoteIdByMarker.mockRejectedValue(new Error('Intercom API error (503): upstream'));

    const result = await syncIntercomIntelligence(11);
    expect(result.status).toBe('failed');
    expect(mockUpdateIntercomSync).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('retries write-back after a previous failure', async () => {
    mockFindById.mockResolvedValue({
      ...readyConversation,
      intercomSyncStatus: 'failed',
      intercomSyncError: 'Intercom API error (503): upstream'
    });
    mockFindNoteIdByMarker.mockResolvedValue(null);
    mockReplyWithNote.mockResolvedValue({ noteId: 'note-2' });
    mockEnsureConversationTag.mockResolvedValue(undefined);

    const result = await syncIntercomIntelligence(11);
    expect(result.status).toBe('synced');
    expect(mockReplyWithNote).toHaveBeenCalledTimes(1);
  });

  it('keeps intelligence synced when conversation tags fail independently', async () => {
    mockFindById.mockResolvedValue(readyConversation);
    mockFindNoteIdByMarker.mockResolvedValue(null);
    mockReplyWithNote.mockResolvedValue({ noteId: 'note-tags' });
    mockEnsureConversationTag.mockRejectedValue(new Error('Intercom API error (403): forbidden'));

    const result = await syncIntercomIntelligence(11);
    expect(result.status).toBe('synced');
    expect(result.noteId).toBe('note-tags');
    expect(mockReplyWithNote).toHaveBeenCalledTimes(1);
  });
});
