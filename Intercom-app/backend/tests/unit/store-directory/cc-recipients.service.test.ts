import { jest } from '@jest/globals';
import type {
  FixedContactLookupRow,
  StoreDirectoryLookupRow
} from '../../../src/modules/store-directory/store-directory.repository.js';

const mockFindStoresByNumber =
  jest.fn<(storeNumber: string) => Promise<StoreDirectoryLookupRow[]>>();
const mockFindFixedContacts =
  jest.fn<(companyId: number) => Promise<FixedContactLookupRow[]>>();

await jest.unstable_mockModule(
  '../../../src/modules/store-directory/store-directory.repository.js',
  () => ({
    storeDirectoryRepository: {
      findStoresByNumber: mockFindStoresByNumber,
      findFixedContacts: mockFindFixedContacts
    }
  })
);

const { ccRecipientsService } = await import(
  '../../../src/modules/store-directory/cc-recipients.service.js'
);

const resolveWithSender = ccRecipientsService.resolveForStoreNumber as (
  storeNumber: string,
  senderEmail?: string | null
) => ReturnType<typeof ccRecipientsService.resolveForStoreNumber>;

const store = (
  companyId: number,
  companySlug: string,
  companyName: string,
  email: string
): StoreDirectoryLookupRow => ({
  companyId,
  companySlug,
  companyName,
  storeNumber: '413',
  storeName: `Store 413 — ${companyName}`,
  vpName: companySlug === 'northwind-bakery' ? 'Premium VP' : null,
  vpEmail: companySlug === 'northwind-bakery' ? email : null,
  directorName: null,
  directorEmail: null,
  districtManagerName: 'District Manager',
  districtManagerEmail: email,
  ownerName: null,
  ownerEmail: null
});

describe('CC recipient duplicate-store resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFixedContacts.mockResolvedValue([]);
  });

  it('keeps existing behavior when the store number has one match', async () => {
    mockFindStoresByNumber.mockResolvedValue([
      store(1, 'northwind-bakery', 'Northwind Bakery', 'dm@northwind.co')
    ]);

    const result = await resolveWithSender('413', 'store@unrelated-company.com');

    expect(result.status).toBe('ok');
    expect(result.companyName).toBe('Northwind Bakery');
  });

  it('selects the duplicate store whose recipient domain matches the sender domain', async () => {
    mockFindStoresByNumber.mockResolvedValue([
      store(1, 'northwind-bakery', 'Northwind Bakery', 'dm@northwind.co'),
      store(2, 'helix-hospitality', 'Helix Hospitality', 'dm@helix.co')
    ]);

    const result = await resolveWithSender('413', '413@helix.co');

    expect(result.status).toBe('ok');
    expect(result.companyName).toBe('Helix Hospitality');
    expect(result.recipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'dm@helix.co' })
      ])
    );
    expect(result.recipients).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'dm@northwind.co' })
      ])
    );
  });

  it('uses fixed-contact email domains when store contacts do not identify the company', async () => {
    mockFindStoresByNumber.mockResolvedValue([
      store(1, 'northwind-bakery', 'Northwind Bakery', 'premium.manager@gmail.com'),
      store(2, 'helix-hospitality', 'Helix Hospitality', 'chc.manager@gmail.com')
    ]);
    mockFindFixedContacts.mockImplementation(async (companyId) =>
      companyId === 2
        ? [
            {
              name: 'CHC HR',
              email: 'hr@helix.co',
              role: 'HR Group',
              sortOrder: 0
            }
          ]
        : []
    );

    const result = await resolveWithSender('413', '413@helix.co');

    expect(result.status).toBe('ok');
    expect(result.companyName).toBe('Helix Hospitality');
  });

  it('does not use personal sender or recipient domains to choose a duplicate', async () => {
    mockFindStoresByNumber.mockResolvedValue([
      store(1, 'northwind-bakery', 'Northwind Bakery', 'manager@gmail.com'),
      store(2, 'helix-hospitality', 'Helix Hospitality', 'other@gmail.com')
    ]);

    const result = await resolveWithSender('413', 'store@gmail.com');

    expect(result).toMatchObject({
      status: 'ambiguous',
      storeNumber: '413',
      companyName: null,
      recipients: []
    });
  });

  it('does not guess when the sender domain matches no duplicate company', async () => {
    mockFindStoresByNumber.mockResolvedValue([
      store(1, 'northwind-bakery', 'Northwind Bakery', 'dm@northwind.co'),
      store(2, 'helix-hospitality', 'Helix Hospitality', 'dm@helix.co')
    ]);

    const result = await resolveWithSender('413', '413@unknown-company.com');

    expect(result).toMatchObject({
      status: 'ambiguous',
      storeNumber: '413',
      companyName: null,
      recipients: []
    });
  });
});
