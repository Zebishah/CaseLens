import { jest } from '@jest/globals';

const mockFindMentionsByEmployeeIdentityIds = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindAliasesByEmployeeIdentityIds = jest.fn<() => Promise<Array<Record<string, unknown>>>>();

await jest.unstable_mockModule(
  '../../../src/modules/conversation/conversation-employees.repository.js',
  () => ({
    conversationEmployeesRepository: {
      findMentionsByEmployeeIdentityIds: mockFindMentionsByEmployeeIdentityIds
    }
  })
);

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findAliasesByEmployeeIdentityIds: mockFindAliasesByEmployeeIdentityIds
  }
}));

const { employeeNameVariantService } = await import(
  '../../../src/modules/employee/employee.name-variant.service.js'
);

describe('employeeNameVariantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAliasesByEmployeeIdentityIds.mockResolvedValue([]);
  });

  it('adds similar extracted spellings from other conversations', async () => {
    mockFindMentionsByEmployeeIdentityIds.mockResolvedValue([
      {
        employeeIdentityId: 1,
        extractedName: 'Zohaib Haider',
        confidenceScore: 100,
        matchMethod: 'exact',
        conversationId: 2
      },
      {
        employeeIdentityId: 1,
        extractedName: 'Zuhaib Hayder',
        confidenceScore: 82,
        matchMethod: 'fuzzy',
        conversationId: 5
      }
    ]);

    const enriched = await employeeNameVariantService.enrichMatches([
      {
        employeeIdentityId: 1,
        canonicalName: 'Syed Zohaib Haider',
        confidenceScore: 100,
        matchMethod: 'exact'
      }
    ]);

    expect(enriched[0]?.nameVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantName: 'Zohaib Haider',
          confidenceScore: 100,
          matchMethod: 'exact'
        }),
        expect.objectContaining({
          variantName: 'Zuhaib Hayder',
          confidenceScore: 82,
          matchMethod: 'fuzzy'
        })
      ])
    );
  });

  it('returns matches unchanged when no alternate spellings exist', async () => {
    mockFindMentionsByEmployeeIdentityIds.mockResolvedValue([
      {
        employeeIdentityId: 1,
        extractedName: 'Johan Liebert',
        confidenceScore: 100,
        matchMethod: 'exact',
        conversationId: 2
      }
    ]);

    const matches = [
      {
        employeeIdentityId: 1,
        canonicalName: 'Johan Liebert',
        confidenceScore: 100,
        matchMethod: 'exact'
      }
    ];

    const enriched = await employeeNameVariantService.enrichMatches(matches);
    expect(enriched).toEqual(matches);
  });
});
