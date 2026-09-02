import {
  filterEmployeeSearchNoticesForDisplay,
  isTransientEmployeeSearchNotice
} from '../../../src/constants/employee-search.constants.js';

describe('employee search notice filtering', () => {
  it('detects transient domain search notices', () => {
    expect(
      isTransientEmployeeSearchNotice('Searching employees for company domain demoops.co.')
    ).toBe(true);
  });

  it('removes transient domain search notices when a match exists', () => {
    expect(
      filterEmployeeSearchNoticesForDisplay(
        ['Searching employees for company domain demoops.co.'],
        { employeeMatchCount: 1 }
      )
    ).toEqual([]);
  });

  it('keeps store-failure notice while awaiting company domain search', () => {
    expect(
      filterEmployeeSearchNoticesForDisplay(
        ['No employee match found using store number 10206.'],
        { employeeMatchCount: 0, awaitingCompanyDomainSearch: true }
      )
    ).toEqual(['No employee match found using store number 10206.']);
  });

  it('hides automatic-create notices from the sidebar', () => {
    expect(
      filterEmployeeSearchNoticesForDisplay(
        [
          'No matching employee found — created a new employee record.',
          'Possible duplicate: Alex Kim (77%)'
        ],
        { employeeMatchCount: 1 }
      )
    ).toEqual([]);
  });
});
