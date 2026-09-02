import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import {
  isQuotaExhaustedError,
  shouldSkipIntelligenceProcessing
} from '../../../src/modules/intelligence/intelligence-attempt.util.js';
import { shouldReprocessIntelligence } from '../../../src/modules/intelligence/intelligence-stale.util.js';

describe('intelligence attempt limits', () => {
  it('detects quota exhausted errors', () => {
    expect(
      isQuotaExhaustedError(
        'Gemini API error 429: {"error":{"message":"Your prepayment credits are depleted"}}'
      )
    ).toBe(true);
  });

  it('does not reprocess failed conversations when message count is unchanged', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.FAILED,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 3,
            failureAttempts: 1,
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        3
      )
    ).toBe(false);
  });

  it('skips processing after max attempts at the same message count', () => {
    expect(
      shouldSkipIntelligenceProcessing(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.FAILED,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 3,
            failureAttempts: 3,
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        3
      )
    ).toBe(true);
  });

  it('allows reprocessing failed conversations when new messages arrive', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.FAILED,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 3,
            failureAttempts: 2,
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(true);
  });
});
