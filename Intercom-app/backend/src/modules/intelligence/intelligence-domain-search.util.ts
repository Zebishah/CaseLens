export const resolveDomainSearchSnapshotFlags = (input: {
  subjectChangedSinceProcessing: boolean;
  awaitingCompanyDomainSearch: boolean;
  companyDomainSearchAttemptedOnSnapshot?: boolean;
  forceDomainEmployeeSearch?: boolean;
  forceStoreEmployeeSearch?: boolean;
}): {
  awaitingCompanyDomainSearch: boolean;
  companyDomainSearchAttempted: boolean;
} => {
  const forceDomainEmployeeSearch = input.forceDomainEmployeeSearch === true;
  const forceStoreEmployeeSearch = input.forceStoreEmployeeSearch === true;
  const priorAttempted = input.companyDomainSearchAttemptedOnSnapshot === true;
  const subjectChanged = input.subjectChangedSinceProcessing;

  const companyDomainSearchAttempted = forceStoreEmployeeSearch
    ? false
    : forceDomainEmployeeSearch || (priorAttempted && !subjectChanged);

  const awaitingCompanyDomainSearch =
    !companyDomainSearchAttempted &&
    input.awaitingCompanyDomainSearch &&
    !forceDomainEmployeeSearch;

  return { awaitingCompanyDomainSearch, companyDomainSearchAttempted };
};
