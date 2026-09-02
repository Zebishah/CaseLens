import { jest } from '@jest/globals';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';

const mockProcessIntelligence = jest.fn<() => Promise<void>>();
const mockFindById = jest.fn();
const mockCountMessages = jest.fn();

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.processor.js', () => ({
  processIntelligenceForConversation: mockProcessIntelligence
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    countMessagesByConversationId: mockCountMessages
  }
}));

const { runIntelligenceOnce } = await import(
  '../../../src/modules/intelligence/intelligence-processing.lock.js'
);

describe('runIntelligenceOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountMessages.mockResolvedValue(1);
  });

  it('skips redundant run after in-flight processing when snapshot is current', async () => {
    let resolveFirst: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    mockProcessIntelligence.mockImplementationOnce(() => firstRun);
    mockFindById.mockResolvedValue({
      id: 1,
      intercomId: '100',
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      subject: 'Attendance - John',
      rawPayload: null,
      intelligenceSnapshot: {
        employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'John', confidenceScore: 100, matchMethod: 'exact' }],
        relatedCases: [],
        messageCount: 1,
        processedSubject: 'Attendance - John',
        extractionSource: 'gemini',
        processedAt: '2026-01-01T00:00:00.000Z'
      }
    });

    const input = {
      conversationId: 1,
      intercomId: '100',
      source: 'worker' as const
    };

    const firstCall = runIntelligenceOnce(input);
    const secondCall = runIntelligenceOnce(input);

    resolveFirst?.();
    await Promise.all([firstCall, secondCall]);

    expect(mockProcessIntelligence).toHaveBeenCalledTimes(1);
  });

  it('re-runs after in-flight processing when force domain search is requested', async () => {
    let resolveFirst: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    mockProcessIntelligence
      .mockImplementationOnce(() => firstRun)
      .mockResolvedValueOnce(undefined);

    const input = {
      conversationId: 1,
      intercomId: '100',
      source: 'canvas' as const,
      forceReprocess: true,
      forceDomainEmployeeSearch: true
    };

    const firstCall = runIntelligenceOnce(input);
    const secondCall = runIntelligenceOnce(input);

    resolveFirst?.();
    await Promise.all([firstCall, secondCall]);

    expect(mockProcessIntelligence).toHaveBeenCalledTimes(2);
  });
});
