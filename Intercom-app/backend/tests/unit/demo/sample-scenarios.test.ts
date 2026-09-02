import { describe, expect, test } from '@jest/globals';
import { getSampleScenario, SAMPLE_SCENARIOS } from '../../../src/modules/demo/sample-scenarios.js';

describe('sample scenarios', () => {
  test('covers the required recruiter demonstration paths', () => {
    const ids = SAMPLE_SCENARIOS.map((scenario) => scenario.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'confident-employee',
        'store-from-email',
        'related-history',
        'unrelated-rejected',
        'ambiguous-employee',
        'missing-store',
        'store-stakeholders',
        'multiple-cc',
        'low-confidence-review'
      ])
    );
    expect(getSampleScenario('confident-employee')?.body.length).toBeGreaterThan(20);
  });
});
