import { EMPLOYEE_MATCH_METHOD } from '../../../src/constants/intelligence.constants.js';
import {
  dedupeMatchesByIdentity,
  filterMatchesAboveThreshold,
  similarityToConfidence
} from '../../../src/modules/employee/employee.matching.util.js';

describe('employee.matching.util', () => {
  it('converts pg_trgm similarity to confidence score', () => {
    expect(similarityToConfidence(0.93)).toBe(93);
    expect(similarityToConfidence(1)).toBe(99);
  });

  it('dedupes by employee identity keeping highest confidence', () => {
    const results = dedupeMatchesByIdentity([
      {
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritz',
        confidenceScore: 88,
        matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
      },
      {
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritz',
        confidenceScore: 100,
        matchMethod: EMPLOYEE_MATCH_METHOD.EXACT
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.confidenceScore).toBe(100);
  });

  it('filters matches below threshold', () => {
    const results = filterMatchesAboveThreshold([
      {
        employeeIdentityId: 1,
        canonicalName: 'A',
        confidenceScore: 59,
        matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
      },
      {
        employeeIdentityId: 2,
        canonicalName: 'B',
        confidenceScore: 60,
        matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.employeeIdentityId).toBe(2);
  });
});
