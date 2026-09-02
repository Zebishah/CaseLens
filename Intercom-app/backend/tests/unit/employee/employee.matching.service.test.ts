import { jest } from '@jest/globals';
import { EMPLOYEE_MATCH_METHOD } from '../../../src/constants/intelligence.constants.js';
import { EMPLOYEE_SEARCH_NOTICE } from '../../../src/constants/employee-search.constants.js';

const mockFindByIntercomContactId = jest.fn<() => Promise<undefined | { id: number; canonicalName: string }>>();
const mockFindByEmail = jest.fn<() => Promise<undefined | { id: number; canonicalName: string }>>();
const mockFindByCanonicalName = jest.fn<() => Promise<undefined | { id: number; canonicalName: string }>>();
const mockFindAllByCanonicalName = jest.fn<
  (name: string) => Promise<Array<{ id: number; canonicalName: string }>>
>();
const mockFindAliasOwner = jest.fn<
  () => Promise<
    undefined | {
      identity: { id: number; canonicalName: string };
      aliasRow: { confidenceScore: string };
    }
  >
>();
const mockFindFuzzyByCanonicalName = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string; similarity: number }>>
>();
const mockFindFuzzyByAlias = jest.fn<
  () => Promise<Array<{ employeeIdentityId: number; canonicalName: string; similarity: number }>>
>();
const mockFindAll = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindByStoreNumber = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindIdentitiesLinkedAtStoreConversations = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string }>>
>();
const mockFindIdentitiesLinkedAtCompanyDomainConversations = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string }>>
>();
const mockCountOtherConversationsAtStore = jest.fn<() => Promise<number>>();
const mockFindByCompanyDomain = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindUnscoped = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindReporterEmailHistoryByIdentityIds = jest.fn<
  () => Promise<Map<number, { businessDomains: string[]; publicEmails: string[] }>>
>();
const mockCreateIdentity = jest.fn<
  () => Promise<{ id: number; canonicalName: string; email: string | null; intercomContactId: string | null }>
>();
const mockCreateAlias = jest.fn<() => Promise<{ id: number } | undefined>>();
const mockUpdateIdentityScopeIfEmpty = jest.fn<() => Promise<void>>();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    countOtherConversationsAtStore: mockCountOtherConversationsAtStore
  }
}));

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findByIntercomContactId: mockFindByIntercomContactId,
    findByEmail: mockFindByEmail,
    findByCanonicalName: mockFindByCanonicalName,
    findAllByCanonicalName: mockFindAllByCanonicalName,
    findAliasOwner: mockFindAliasOwner,
    findFuzzyByCanonicalName: mockFindFuzzyByCanonicalName,
    findFuzzyByAlias: mockFindFuzzyByAlias,
    findAll: mockFindAll,
    findByStoreNumber: mockFindByStoreNumber,
    findIdentitiesLinkedAtStoreConversations: mockFindIdentitiesLinkedAtStoreConversations,
    findIdentitiesLinkedAtCompanyDomainConversations: mockFindIdentitiesLinkedAtCompanyDomainConversations,
    findByCompanyDomain: mockFindByCompanyDomain,
    findUnscoped: mockFindUnscoped,
    findReporterEmailHistoryByIdentityIds: mockFindReporterEmailHistoryByIdentityIds,
    createIdentity: mockCreateIdentity,
    createAlias: mockCreateAlias,
    updateIdentityScopeIfEmpty: mockUpdateIdentityScopeIfEmpty
  }
}));

const { employeeMatchingService } = await import(
  '../../../src/modules/employee/employee.matching.service.js'
);
const { EMPLOYEE_SEARCH_PATH } = await import(
  '../../../src/constants/employee-search.constants.js'
);

describe('employeeMatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByIntercomContactId.mockResolvedValue(undefined);
    mockFindByEmail.mockResolvedValue(undefined);
    mockFindByCanonicalName.mockResolvedValue(undefined);
    mockFindAllByCanonicalName.mockImplementation(async (name: string) => {
      const row = await mockFindByCanonicalName(name);
      return row ? [row] : [];
    });
    mockFindAliasOwner.mockResolvedValue(undefined);
    mockFindFuzzyByCanonicalName.mockResolvedValue([]);
    mockFindFuzzyByAlias.mockResolvedValue([]);
    mockFindAll.mockResolvedValue([]);
    mockFindByStoreNumber.mockResolvedValue([]);
    mockFindIdentitiesLinkedAtStoreConversations.mockResolvedValue([]);
    mockFindIdentitiesLinkedAtCompanyDomainConversations.mockResolvedValue([]);
    mockCountOtherConversationsAtStore.mockResolvedValue(0);
    mockFindByCompanyDomain.mockResolvedValue([]);
    mockFindUnscoped.mockResolvedValue([]);
    mockFindReporterEmailHistoryByIdentityIds.mockResolvedValue(new Map());
    mockCreateAlias.mockResolvedValue({ id: 1 });
    mockUpdateIdentityScopeIfEmpty.mockResolvedValue(undefined);
  });

  it('returns exact email match at 100% confidence', async () => {
    mockFindByEmail.mockResolvedValue({ id: 1, canonicalName: 'Jonathan Fritz' });

    const results = await employeeMatchingService.match({
      contactName: 'Jon Fritz',
      contactEmail: 'jonathan.fritz@example.com'
    });

    expect(results).toEqual([
      {
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritz',
        confidenceScore: 100,
        matchMethod: EMPLOYEE_MATCH_METHOD.EXACT
      }
    ]);
  });

  it('returns alias match with stored confidence', async () => {
    mockFindAliasOwner.mockResolvedValue({
      identity: { id: 1, canonicalName: 'Jonathan Fritz' },
      aliasRow: { confidenceScore: '93' }
    });

    const results = await employeeMatchingService.match({
      contactName: 'Jon Fritz',
      contactEmail: null
    });

    expect(results[0]).toMatchObject({
      employeeIdentityId: 1,
      confidenceScore: 93,
      matchMethod: EMPLOYEE_MATCH_METHOD.ALIAS
    });
  });

  it('returns fuzzy match when similarity is above threshold', async () => {
    mockFindFuzzyByCanonicalName.mockResolvedValue([
      { id: 2, canonicalName: 'Jonathan Fritz', similarity: 0.72 }
    ]);

    const results = await employeeMatchingService.match({
      contactName: 'Johnathan Fritz',
      contactEmail: null
    });

    expect(results[0]).toMatchObject({
      employeeIdentityId: 2,
      confidenceScore: 72,
      matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
    });
  });

  it('filters out matches below 60% confidence', async () => {
    mockFindFuzzyByAlias.mockResolvedValue([
      { employeeIdentityId: 3, canonicalName: 'Someone Else', similarity: 0.4 }
    ]);

    const results = await employeeMatchingService.match({
      contactName: 'Totally Different',
      contactEmail: null
    });

    expect(results).toEqual([]);
  });

  it('tries stripped company suffix variant for matching', async () => {
    mockFindByCanonicalName.mockImplementation(async (name: string) => {
      if (name === 'Mohammad Nehaal') {
        return { id: 5, canonicalName: 'Mohammad Nehaal' };
      }
      return undefined;
    });

    const results = await employeeMatchingService.match({
      contactName: 'Mohammad Nehaal from JidatIT',
      contactEmail: null
    });

    expect(mockFindByCanonicalName).toHaveBeenCalledWith('Mohammad Nehaal from JidatIT');
    expect(mockFindByCanonicalName).toHaveBeenCalledWith('Mohammad Nehaal');
    expect(results[0]?.employeeIdentityId).toBe(5);
  });

  describe('resolve', () => {
    it('creates a new employee identity when no match exists', async () => {
      mockCreateIdentity.mockResolvedValue({
        id: 10,
        canonicalName: 'Mohammad Nehaal',
        email: 'nehaal@demoops.co',
        intercomContactId: 'contact-123'
      });

      const results = await employeeMatchingService.resolve({
        contactName: 'Mohammad Nehaal from JidatIT',
        contactEmail: 'nehaal@demoops.co',
        intercomContactId: 'contact-123'
      });

      expect(mockCreateIdentity).toHaveBeenCalledWith({
        canonicalName: 'Mohammad Nehaal',
        email: 'nehaal@demoops.co',
        intercomContactId: 'contact-123'
      });
      expect(mockCreateAlias).toHaveBeenCalled();
      expect(results).toEqual([
        {
          employeeIdentityId: 10,
          canonicalName: 'Mohammad Nehaal',
          confidenceScore: 100,
          matchMethod: EMPLOYEE_MATCH_METHOD.EXACT
        }
      ]);
    });

    it('reuses existing identity instead of creating when contact id already exists', async () => {
      mockFindByIntercomContactId.mockResolvedValue({
        id: 7,
        canonicalName: 'Mohammad Nehaal'
      });

      const results = await employeeMatchingService.resolve({
        contactName: 'Mohammad Nehaal from JidatIT',
        contactEmail: 'nehaal@demoops.co',
        intercomContactId: 'contact-123'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(results[0]?.employeeIdentityId).toBe(7);
    });

    it('learns alias when match found via email with a new display name', async () => {
      mockFindByEmail.mockResolvedValue({ id: 1, canonicalName: 'Jonathan Fritz' });

      await employeeMatchingService.resolve({
        contactName: 'Jon Fritz from Acme',
        contactEmail: 'jonathan.fritz@example.com'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(mockCreateAlias).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeIdentityId: 1,
          alias: 'Jon Fritz from Acme'
        })
      );
    });
  });

  describe('resolveByName', () => {
    it('matches an existing identity by extracted employee name globally', async () => {
      mockFindByCanonicalName.mockResolvedValue({ id: 1, canonicalName: 'Jonathan Fritsch' });

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Jonathan Fritsch',
        caseReporterEmail: '10206@demoops.co'
      });

      expect(mockFindByStoreNumber).not.toHaveBeenCalled();
      expect(mockFindByCompanyDomain).not.toHaveBeenCalled();
      expect(resolution.searchPath).toBe(EMPLOYEE_SEARCH_PATH.NAME);
      expect(resolution.awaitingCompanyDomainSearch).toBeUndefined();
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritsch'
      });
    });

    it('matches across stores and domains without scoping', async () => {
      mockFindByCanonicalName.mockResolvedValue({ id: 7, canonicalName: 'Pat Ventura' });

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Pat Ventura',
        caseReporterEmail: '413@northwind.co',
        caseReporterName: '413premium'
      });

      expect(resolution.searchPath).toBe(EMPLOYEE_SEARCH_PATH.NAME);
      expect(resolution.matches[0]?.employeeIdentityId).toBe(7);
      expect(mockFindByStoreNumber).not.toHaveBeenCalled();
    });

    it('creates a new employee when no directory match exists', async () => {
      mockCreateIdentity.mockResolvedValue({
        id: 42,
        canonicalName: 'Ayesha Khan',
        email: null,
        intercomContactId: null,
        storeNumber: null,
        companyDomain: null
      });

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Ayesha Khan'
      });

      expect(mockCreateIdentity).toHaveBeenCalledWith(
        expect.objectContaining({ canonicalName: 'Ayesha Khan' })
      );
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.searchPath).toBe(EMPLOYEE_SEARCH_PATH.CREATED);
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 42,
        canonicalName: 'Ayesha Khan',
        confidenceScore: 100
      });
      expect(resolution.notices).toEqual(
        expect.arrayContaining([EMPLOYEE_SEARCH_NOTICE.CREATED_NEW_EMPLOYEE])
      );
    });

    it('links typo extracted names to an existing identity', async () => {
      mockFindFuzzyByCanonicalName.mockResolvedValue([
        { id: 1, canonicalName: 'Jonathan Fritsch', similarity: 0.86 }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Jonathon Fritsch'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritsch'
      });
    });

    it('links Johnathan Frish to Jonathan Fritsch instead of creating a duplicate', async () => {
      mockFindAll.mockResolvedValue([{ id: 1, canonicalName: 'Jonathan Fritsch' }]);
      mockFindFuzzyByCanonicalName.mockResolvedValue([
        { id: 1, canonicalName: 'Jonathan Fritsch', similarity: 0.82 }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Johnathan Frish'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritsch'
      });
    });

    it('creates an employee when a near-miss spelling has no directory match', async () => {
      mockFindByCanonicalName.mockImplementation(async (name: string) => {
        if (name === 'Jonathan Fritsch') {
          return { id: 1, canonicalName: 'Jonathan Fritsch' };
        }
        return undefined;
      });
      mockFindAliasOwner.mockResolvedValue(undefined);
      mockCreateIdentity.mockResolvedValue({
        id: 88,
        canonicalName: 'Jon Fritsch',
        email: null,
        intercomContactId: null,
        storeNumber: null,
        companyDomain: null
      });

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Jon Fritsch'
      });

      expect(mockCreateIdentity).toHaveBeenCalled();
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches[0]?.employeeIdentityId).toBe(88);
    });

    it('resolves a one-word name when the directory has one exact match', async () => {
      mockFindByCanonicalName.mockResolvedValue({ id: 4, canonicalName: 'Ahmed' });

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Ahmed'
      });

      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches).toEqual([
        expect.objectContaining({ employeeIdentityId: 4, canonicalName: 'Ahmed' })
      ]);
    });

    it('requires manual review when two directory employees share the same name', async () => {
      mockFindAllByCanonicalName.mockResolvedValue([
        { id: 4, canonicalName: 'Ahmed' },
        { id: 9, canonicalName: 'Ahmed' }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Ahmed'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.matches).toEqual([]);
      expect(resolution.mentionStatus).toBe('ambiguous');
    });

    it('links a surname-only mention to the existing full-name identity', async () => {
      mockFindAll.mockResolvedValue([
        { id: 7, canonicalName: 'Darren Watkins' },
        { id: 9, canonicalName: 'Darin Wakins' }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Watkins'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 7,
        canonicalName: 'Darren Watkins'
      });
    });

    it('prefers an existing full name over a surname-only identity created earlier', async () => {
      mockFindByCanonicalName.mockImplementation(async (name: string) => {
        if (name === 'Watkins') {
          return { id: 8, canonicalName: 'Watkins' };
        }
        return undefined;
      });
      mockFindAll.mockResolvedValue([
        { id: 7, canonicalName: 'Darren Watkins' },
        { id: 8, canonicalName: 'Watkins' },
        { id: 9, canonicalName: 'Darin Wakins' }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Watkins'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 7,
        canonicalName: 'Darren Watkins'
      });
    });

    it('links Sophie/Sophy spellings to the existing identity instead of creating another', async () => {
      mockFindAll.mockResolvedValue([{ id: 5, canonicalName: 'Ayesha Sophy' }]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Ayesha Sophie'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 5,
        canonicalName: 'Ayesha Sophy'
      });
    });

    it('collapses already-split Sophie/Sophy identities onto the oldest record', async () => {
      mockFindByCanonicalName.mockImplementation(async (name: string) => {
        if (name === 'Ayesha Sophie') {
          return { id: 8, canonicalName: 'Ayesha Sophie' };
        }
        return undefined;
      });
      mockFindAll.mockResolvedValue([
        { id: 5, canonicalName: 'Ayesha Sophy' },
        { id: 8, canonicalName: 'Ayesha Sophie' }
      ]);

      const resolution = await employeeMatchingService.resolveByName({
        extractedName: 'Ayesha Sophie'
      });

      expect(mockCreateIdentity).not.toHaveBeenCalled();
      expect(resolution.mentionStatus).toBe('resolved');
      expect(resolution.matches[0]).toMatchObject({
        employeeIdentityId: 5,
        canonicalName: 'Ayesha Sophy'
      });
    });
  });

});
