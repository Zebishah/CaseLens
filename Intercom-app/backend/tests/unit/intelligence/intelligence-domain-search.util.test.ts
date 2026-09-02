import { resolveDomainSearchSnapshotFlags } from '../../../src/modules/intelligence/intelligence-domain-search.util.js';

describe('resolveDomainSearchSnapshotFlags', () => {
  it('offers domain search again when subject changed and store search is awaiting domain', () => {
    expect(
      resolveDomainSearchSnapshotFlags({
        subjectChangedSinceProcessing: true,
        awaitingCompanyDomainSearch: true,
        companyDomainSearchAttemptedOnSnapshot: true
      })
    ).toEqual({
      awaitingCompanyDomainSearch: true,
      companyDomainSearchAttempted: false
    });
  });

  it('keeps domain search closed when prior attempt stands and subject did not change', () => {
    expect(
      resolveDomainSearchSnapshotFlags({
        subjectChangedSinceProcessing: false,
        awaitingCompanyDomainSearch: true,
        companyDomainSearchAttemptedOnSnapshot: true
      })
    ).toEqual({
      awaitingCompanyDomainSearch: false,
      companyDomainSearchAttempted: true
    });
  });

  it('marks domain search attempted after user triggers domain search', () => {
    expect(
      resolveDomainSearchSnapshotFlags({
        subjectChangedSinceProcessing: true,
        awaitingCompanyDomainSearch: true,
        companyDomainSearchAttemptedOnSnapshot: false,
        forceDomainEmployeeSearch: true
      })
    ).toEqual({
      awaitingCompanyDomainSearch: false,
      companyDomainSearchAttempted: true
    });
  });

  it('clears domain widen when user triggers store search', () => {
    expect(
      resolveDomainSearchSnapshotFlags({
        subjectChangedSinceProcessing: false,
        awaitingCompanyDomainSearch: true,
        companyDomainSearchAttemptedOnSnapshot: true,
        forceStoreEmployeeSearch: true
      })
    ).toEqual({
      awaitingCompanyDomainSearch: true,
      companyDomainSearchAttempted: false
    });
  });
});
