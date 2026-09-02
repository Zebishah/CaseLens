export const EMPLOYEE_SEARCH_PATH = {
  STORE: 'store',
  DOMAIN: 'domain',
  NAME: 'name',
  CREATED: 'created'
} as const;

export type EmployeeSearchPath =
  (typeof EMPLOYEE_SEARCH_PATH)[keyof typeof EMPLOYEE_SEARCH_PATH];

export const EMPLOYEE_SEARCH_NOTICE = {
  NO_STORE_SEARCHING_DOMAIN: 'No store number found — showing company-wide results.',
  noStoreMatchOfferDomainSearch: (storeNumber: string): string =>
    `No employee match found using store number ${storeNumber}.`,
  NO_EXACT_STORE_MATCH: 'No exact employee match in this store — review possible matches below.',
  searchingCompanyDomain: (domain: string): string =>
    `Searching employees for company domain ${domain}.`,
  noDomainMatchSearchingName: (domain: string): string =>
    `No employee match for domain ${domain} — searching all employees by name.`,
  CREATED_NEW_EMPLOYEE: 'No matching employee found — created a new employee record.',
  UNRESOLVED_EMPLOYEE:
    'This name is not in the employee directory yet — confirm in HR records before treating it as matched.',
  possibleDuplicate: (canonicalName: string, confidencePercent: number): string =>
    `Possible duplicate: ${canonicalName} (${confidencePercent}%)`
} as const;

/** In-progress only — do not persist after a match is found. */
export const isTransientEmployeeSearchNotice = (notice: string): boolean =>
  notice.trim().startsWith('Searching employees for company domain ');

/** Hidden from Intercom sidebar — still computed/stored for matching logic. */
export const isHiddenEmployeeSearchNotice = (notice: string): boolean =>
  notice.trim().startsWith('Possible duplicate:') ||
  notice.trim() === EMPLOYEE_SEARCH_NOTICE.CREATED_NEW_EMPLOYEE;

export const filterEmployeeSearchNoticesForDisplay = (
  notices: string[] | undefined,
  options?: {
    employeeMatchCount?: number;
    awaitingCompanyDomainSearch?: boolean;
  }
): string[] => {
  const unique = [...new Set((notices ?? []).map((notice) => notice.trim()).filter(Boolean))].filter(
    (notice) => !isHiddenEmployeeSearchNotice(notice)
  );

  if (options?.awaitingCompanyDomainSearch) {
    return unique;
  }

  if ((options?.employeeMatchCount ?? 0) > 0) {
    return unique.filter((notice) => !isTransientEmployeeSearchNotice(notice));
  }

  return unique;
};
