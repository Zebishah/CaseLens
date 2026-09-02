import { EMPLOYEE_SEARCH_PATH } from '../../../src/constants/employee-search.constants.js';
import {
  resolveRelatedCasesReporterDomain,
  shouldRestrictRelatedCasesToReporterDomain
} from '../../../src/modules/employee/employee.search-scope.util.js';

describe('employee.search-scope.util', () => {
  it('restricts related cases to domain when no store number is present', () => {
    expect(
      shouldRestrictRelatedCasesToReporterDomain({
        reporterContext: { storeNumber: null, domain: 'acmecorp.com' }
      })
    ).toBe(true);

    expect(
      resolveRelatedCasesReporterDomain({
        reporterContext: { storeNumber: null, domain: 'acmecorp.com' }
      })
    ).toBe('acmecorp.com');
  });

  it('does not restrict related cases when store matching succeeded', () => {
    expect(
      resolveRelatedCasesReporterDomain({
        reporterContext: { storeNumber: '3456', domain: 'acmecorp.com' },
        employeeSearchPath: EMPLOYEE_SEARCH_PATH.STORE,
        employeeSearchNotices: []
      })
    ).toBeNull();
  });

  it('restricts related cases when store search failed', () => {
    expect(
      resolveRelatedCasesReporterDomain({
        reporterContext: { storeNumber: '3456', domain: 'acmecorp.com' },
        employeeSearchPath: EMPLOYEE_SEARCH_PATH.DOMAIN,
        employeeSearchNotices: ['No employee match found using store number 3456.']
      })
    ).toBe('acmecorp.com');
  });

  it('restricts related cases when any extracted name did not match via store', () => {
    expect(
      resolveRelatedCasesReporterDomain({
        reporterContext: { storeNumber: '3456', domain: 'acmecorp.com' },
        employeeSearchPath: EMPLOYEE_SEARCH_PATH.STORE,
        anyNonStoreMatch: true
      })
    ).toBe('acmecorp.com');
  });
});
