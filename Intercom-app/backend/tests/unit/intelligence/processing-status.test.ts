import { describe, expect, test } from '@jest/globals';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import { shouldReprocessIntelligence } from '../../../src/modules/intelligence/intelligence-stale.util.js';

describe('processing status', () => {
  test('a claimed processing case with no snapshot still runs intelligence', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.PROCESSING,
          intelligenceSnapshot: null,
          subject: 'Attendance — Jordan Hale',
          rawPayload: null
        },
        1
      )
    ).toBe(true);
  });
});
