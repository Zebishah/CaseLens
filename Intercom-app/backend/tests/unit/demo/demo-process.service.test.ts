import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';

const mockFindById = jest.fn();
const mockClaim = jest.fn();
const mockUpdate = jest.fn();
const mockProcess = jest.fn(async () => undefined);
const mockEnqueue = jest.fn(async () => undefined);

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    claimIntelligenceProcessing: mockClaim,
    updateIntelligence: mockUpdate
  }
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/process-case-intelligence.js', () => ({
  processCaseIntelligence: mockProcess
}));

await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueue
}));

const { processDemoCase } = await import('../../../src/modules/demo/demo-process.service.js');

const caseRow = {
  id: 42,
  demoSessionId: 7,
  intercomId: 'demo:custom',
  intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
  intelligenceSnapshot: null
};

describe('processDemoCase', () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockClaim.mockReset();
    mockUpdate.mockReset();
    mockProcess.mockClear();
    mockEnqueue.mockClear();
  });

  test('returns existing completed result without reprocessing', async () => {
    mockFindById.mockResolvedValue({
      ...caseRow,
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceSnapshot: { employeeMatches: [] }
    });

    const result = await processDemoCase({ sessionId: 7, conversationId: 42 });
    expect(result.outcome).toBe('already_completed');
    expect(mockProcess).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
  });

  test('does not start a second run while processing', async () => {
    mockFindById.mockResolvedValue({
      ...caseRow,
      intelligenceStatus: INTELLIGENCE_STATUS.PROCESSING
    });

    const result = await processDemoCase({ sessionId: 7, conversationId: 42 });
    expect(result.outcome).toBe('in_progress');
    expect(mockProcess).not.toHaveBeenCalled();
  });

  test('claims queued work and runs the shared processor', async () => {
    const ready = {
      ...caseRow,
      intelligenceStatus: INTELLIGENCE_STATUS.READY,
      intelligenceSnapshot: { employeeMatches: [{ canonicalName: 'Jordan Hale' }] }
    };
    mockFindById.mockResolvedValue(ready);
    mockFindById.mockResolvedValueOnce(caseRow);
    mockClaim.mockResolvedValue(true);

    const result = await processDemoCase({ sessionId: 7, conversationId: 42 });
    expect(mockClaim).toHaveBeenCalledWith(42);
    expect(mockProcess).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 42, source: 'inline' })
    );
    expect(result.outcome).toBe('completed');
  });

  test('records failed state when the processor throws', async () => {
    mockFindById.mockResolvedValue(caseRow);
    mockClaim.mockResolvedValue(true);
    mockProcess.mockRejectedValueOnce(new Error('Validation error: invalid payload'));

    const result = await processDemoCase({ sessionId: 7, conversationId: 42 });
    expect(result.outcome).toBe('failed');
    expect(mockUpdate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ status: INTELLIGENCE_STATUS.FAILED })
    );
  });

  test('treats a lost claim as already completed when the case is ready', async () => {
    mockFindById
      .mockResolvedValueOnce(caseRow)
      .mockResolvedValue({
        ...caseRow,
        intelligenceStatus: INTELLIGENCE_STATUS.READY,
        intelligenceSnapshot: { employeeMatches: [] }
      });
    mockClaim.mockResolvedValue(false);

    const result = await processDemoCase({ sessionId: 7, conversationId: 42 });
    expect(result.outcome).toBe('already_completed');
    expect(mockProcess).not.toHaveBeenCalled();
  });

  test('rejects cases from another demo session', async () => {
    mockFindById.mockResolvedValue({ ...caseRow, demoSessionId: 99 });
    await expect(processDemoCase({ sessionId: 7, conversationId: 42 })).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
