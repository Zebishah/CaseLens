import { shouldPreserveEmployeeMatchesOnDomainSearch } from '../../../src/modules/intelligence/intelligence-domain-display.util.js';

describe('intelligence-domain-display.util', () => {
  it('preserves existing employee matches when widening a store ticket to company domain', () => {
    expect(
      shouldPreserveEmployeeMatchesOnDomainSearch({
        forceDomainEmployeeSearch: true,
        forceStoreEmployeeSearch: false,
        subjectChangedSinceProcessing: false,
        storeNumber: '10206',
        existingEmployeeMatchCount: 1
      })
    ).toBe(true);
  });

  it('does not preserve when the subject changed since the last snapshot', () => {
    expect(
      shouldPreserveEmployeeMatchesOnDomainSearch({
        forceDomainEmployeeSearch: true,
        forceStoreEmployeeSearch: false,
        subjectChangedSinceProcessing: true,
        storeNumber: '10206',
        existingEmployeeMatchCount: 1
      })
    ).toBe(false);
  });

  it('does not preserve on domain-only tickets without a store number', () => {
    expect(
      shouldPreserveEmployeeMatchesOnDomainSearch({
        forceDomainEmployeeSearch: true,
        forceStoreEmployeeSearch: false,
        subjectChangedSinceProcessing: false,
        storeNumber: null,
        existingEmployeeMatchCount: 1
      })
    ).toBe(false);
  });
});
