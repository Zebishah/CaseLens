import { jest } from '@jest/globals';

const mockFindAliasesByEmployeeIdentityIds = jest.fn<() => Promise<Array<{ alias: string }>>>();
const mockFindAll = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findAliasesByEmployeeIdentityIds: mockFindAliasesByEmployeeIdentityIds,
    findAll: mockFindAll
  }
}));

const { resolveRelatedCaseSearchInput } = await import(
  '../../../src/modules/intelligence/related-case-search.util.js'
);

describe('resolveRelatedCaseSearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAliasesByEmployeeIdentityIds.mockResolvedValue([]);
    mockFindAll.mockResolvedValue([]);
  });

  it('includes canonical name, extracted spellings, and stored aliases', async () => {
    mockFindAliasesByEmployeeIdentityIds.mockResolvedValue([{ alias: 'Jon Smith' }]);

    const result = await resolveRelatedCaseSearchInput({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'John Smith',
          confidenceScore: 100,
          matchMethod: 'exact',
          extractedName: 'Johnathan Smith',
          nameVariants: [{ variantName: 'Johnathan Smith', confidenceScore: 82, matchMethod: 'token' }]
        }
      ],
      extractedNames: ['John Smith'],
      searchTerms: ['John Smith']
    });

    expect(mockFindAliasesByEmployeeIdentityIds).toHaveBeenCalledWith([1]);
    expect(result.searchTerms).toEqual(
      expect.arrayContaining(['John Smith', 'Johnathan Smith', 'Jon Smith', 'john', 'smith', 'jon'])
    );
    expect(result.employeeNames).toEqual(
      expect.arrayContaining(['John Smith', 'Johnathan Smith', 'Jon Smith'])
    );
    expect(result.employeeIdentityIds).toEqual([1]);
  });

  it('still searches by extracted name when the directory has no match', async () => {
    const result = await resolveRelatedCaseSearchInput({
      employeeMatches: [],
      extractedNames: ['Braden']
    });

    expect(mockFindAliasesByEmployeeIdentityIds).not.toHaveBeenCalled();
    expect(result.employeeIdentityIds).toEqual([]);
    expect(result.employeeNames).toEqual(expect.arrayContaining(['Braden']));
    expect(result.searchTerms).toEqual(expect.arrayContaining(['Braden']));
  });

  it('searches first name, last name, and full name even without a directory match', async () => {
    const result = await resolveRelatedCaseSearchInput({
      employeeMatches: [],
      extractedNames: ['Darren Watkins']
    });

    expect(result.searchTerms).toEqual(
      expect.arrayContaining(['Darren Watkins', 'darren', 'watkins'])
    );
  });

  it('includes typo-variant directory identities in related-case search', async () => {
    mockFindAll.mockResolvedValue([
      { id: 5, canonicalName: 'Ayesha Sophy' },
      { id: 8, canonicalName: 'Ayesha Sophie' }
    ]);

    const result = await resolveRelatedCaseSearchInput({
      employeeMatches: [
        {
          employeeIdentityId: 8,
          canonicalName: 'Ayesha Sophie',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      extractedNames: ['Ayesha Sophie']
    });

    expect(result.employeeIdentityIds).toEqual(expect.arrayContaining([5, 8]));
  });

  it('includes last-name directory identities when the extracted name is a surname', async () => {
    mockFindAll.mockResolvedValue([
      { id: 7, canonicalName: 'Darren Watkins' },
      { id: 8, canonicalName: 'Watkins' }
    ]);

    const result = await resolveRelatedCaseSearchInput({
      employeeMatches: [
        {
          employeeIdentityId: 8,
          canonicalName: 'Watkins',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      extractedNames: ['Watkins']
    });

    expect(result.employeeIdentityIds).toEqual(expect.arrayContaining([7, 8]));
    expect(result.searchTerms).toEqual(
      expect.arrayContaining(['Watkins', 'Darren Watkins', 'watkins'])
    );
  });
});
