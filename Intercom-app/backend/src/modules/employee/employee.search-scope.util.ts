import {
  EMPLOYEE_SEARCH_PATH,
  type EmployeeSearchPath
} from '../../constants/employee-search.constants.js';
import type { ReporterContext } from './employee.reporter-context.util.js';

const hasStoreSearchFailureNotice = (notices: string[] | undefined): boolean =>
  (notices ?? []).some((notice) => notice.includes('store number'));

/** Whether related-case search should be limited to the reporter email domain. */
export const shouldRestrictRelatedCasesToReporterDomain = (input: {
  reporterContext: ReporterContext;
  employeeSearchPath?: EmployeeSearchPath;
  employeeSearchNotices?: string[];
  /** Set when any extracted name did not match via the store roster. */
  anyNonStoreMatch?: boolean;
}): boolean => {
  if (!input.reporterContext.domain) {
    return false;
  }

  if (!input.reporterContext.storeNumber) {
    return true;
  }

  if (input.anyNonStoreMatch) {
    return true;
  }

  if (hasStoreSearchFailureNotice(input.employeeSearchNotices)) {
    return true;
  }

  if (
    input.employeeSearchPath === EMPLOYEE_SEARCH_PATH.DOMAIN ||
    input.employeeSearchPath === EMPLOYEE_SEARCH_PATH.NAME ||
    input.employeeSearchPath === EMPLOYEE_SEARCH_PATH.CREATED
  ) {
    return true;
  }

  return false;
};

export const resolveRelatedCasesReporterDomain = (input: {
  reporterContext: ReporterContext;
  employeeSearchPath?: EmployeeSearchPath;
  employeeSearchNotices?: string[];
  anyNonStoreMatch?: boolean;
}): string | null =>
  shouldRestrictRelatedCasesToReporterDomain(input) ? input.reporterContext.domain : null;
