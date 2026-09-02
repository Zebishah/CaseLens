import { jest } from '@jest/globals';

const mockFindAllExcept = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string; email: string | null }>>
>();

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findAllExcept: mockFindAllExcept
  }
}));

const { possibleMatchService } = await import(
  '../../../src/modules/employee/employee.possible-match.service.js'
);

describe('possibleMatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns token-based possible matches excluding current identity', async () => {
    mockFindAllExcept.mockResolvedValue([
      {
        id: 3,
        canonicalName: 'Syed Zohaib Haider',
        email: 'zebihaider123@gmail.com'
      },
      {
        id: 4,
        canonicalName: 'Mohammad Nehaal',
        email: 'nehaal@demoops.co'
      }
    ]);

    const results = await possibleMatchService.findPossibleSamePerson({
      contactName: 'Zohaib shah',
      contactEmail: 'zohaibhaider151@gmail.com',
      excludeEmployeeIdentityId: 5
    });

    expect(mockFindAllExcept).toHaveBeenCalledWith(5);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      employeeIdentityId: 3,
      canonicalName: 'Syed Zohaib Haider',
      matchMethod: 'token',
      sharedTokens: ['zohaib']
    });
  });
});
