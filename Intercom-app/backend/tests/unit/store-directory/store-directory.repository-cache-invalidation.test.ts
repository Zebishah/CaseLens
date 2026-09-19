import { jest } from '@jest/globals';

let committed = false;
const mockInvalidate = jest.fn(async () => {
  expect(committed).toBe(true);
});
const mockSelect = jest.fn(() => ({
  from: () => ({
    where: () => ({ limit: async () => [] })
  })
}));
const insertChain = {
  values: () => insertChain,
  returning: async () => [{ id: 1 }]
};
const transactionContext = {
  delete: async () => undefined,
  select: mockSelect,
  insert: () => insertChain
};
const mockTransaction = jest.fn(async (callback: (tx: typeof transactionContext) => Promise<void>) => {
  await callback(transactionContext);
  committed = true;
});

await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
  db: {
    transaction: mockTransaction,
    select: mockSelect
  }
}));
await jest.unstable_mockModule('../../../src/modules/store-directory/store-directory.cache.js', () => ({
  invalidateStoreDirectoryCaches: mockInvalidate,
  readDirectoryCache: async () => ({ version: 0, value: null }),
  writeDirectoryCache: async () => undefined,
  storeLookupCacheKey: (storeNumber: string) => `store:${storeNumber}`,
  STORE_DIRECTORY_CACHE_TTL_SECONDS: 600,
  STORE_DIRECTORY_NEGATIVE_CACHE_TTL_SECONDS: 45
}));

const { storeDirectoryRepository } = await import(
  '../../../src/modules/store-directory/store-directory.repository.js'
);

describe('store directory repository cache invalidation', () => {
  beforeEach(() => {
    committed = false;
    mockTransaction.mockClear();
    mockInvalidate.mockClear();
    mockTransaction.mockImplementation(async (callback) => {
      await callback(transactionContext);
      committed = true;
    });
  });

  it('invalidates store and CC cache generation only after a successful replacement commit', async () => {
    await storeDirectoryRepository.replaceDirectoryData([]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate when the PostgreSQL transaction fails', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Error('database transaction failed');
    });

    await expect(storeDirectoryRepository.replaceDirectoryData([])).rejects.toThrow(
      'database transaction failed'
    );
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
