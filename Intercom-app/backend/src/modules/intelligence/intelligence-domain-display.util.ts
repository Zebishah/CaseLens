/** Keep the current ticket employee when the user widens to company domain search. */
export const shouldPreserveEmployeeMatchesOnDomainSearch = (input: {
  forceDomainEmployeeSearch: boolean;
  forceStoreEmployeeSearch: boolean;
  subjectChangedSinceProcessing: boolean;
  storeNumber: string | null | undefined;
  existingEmployeeMatchCount: number;
}): boolean =>
  input.forceDomainEmployeeSearch === true &&
  input.forceStoreEmployeeSearch !== true &&
  !input.subjectChangedSinceProcessing &&
  Boolean(input.storeNumber?.trim()) &&
  input.existingEmployeeMatchCount > 0;
