import {
  getCanonicalNameFromContact,
  getNameMatchVariants,
  normalizeForMatch
} from '../../../src/modules/employee/employee.name.util.js';

describe('employee.name.util', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeForMatch('  Jon Fritz  ')).toBe('jon fritz');
  });

  it('returns stripped and full name when company suffix is present', () => {
    expect(getNameMatchVariants('Mohammad Nehaal from JidatIT')).toEqual([
      'Mohammad Nehaal from JidatIT',
      'Mohammad Nehaal'
    ]);
  });

  it('returns empty array for blank names', () => {
    expect(getNameMatchVariants('   ')).toEqual([]);
    expect(getNameMatchVariants(null)).toEqual([]);
  });

  it('prefers stripped name for canonical identity', () => {
    expect(getCanonicalNameFromContact('Mohammad Nehaal from JidatIT')).toBe('Mohammad Nehaal');
    expect(getCanonicalNameFromContact('Jonathan Fritz')).toBe('Jonathan Fritz');
  });
});
