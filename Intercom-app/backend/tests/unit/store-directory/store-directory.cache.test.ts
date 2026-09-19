import { jest } from '@jest/globals';
import type { Redis } from 'ioredis';

const redisValues = new Map<string, string>();
const evalCalls: unknown[][] = [];
const mockMget = jest.fn(async (...keys: string[]) => keys.map((key) => redisValues.get(key) ?? null));
const mockDel = jest.fn(async (key: string) => Number(redisValues.delete(key)));
const mockEval = jest.fn(async (...args: unknown[]) => {
  evalCalls.push(args);
  const [_script, keyCount, ...values] = args as [string, number, ...string[]];
  if (keyCount === 2) {
    const [versionKey, cacheKey, expectedVersion, serialized] = values;
    const currentVersion = Number(redisValues.get(versionKey!) ?? 0);
    if (currentVersion === Number(expectedVersion)) redisValues.set(cacheKey!, serialized!);
    return Number(currentVersion === Number(expectedVersion));
  }
  const [versionKey] = values;
  const currentVersion = Number(redisValues.get(versionKey!) ?? 0);
  redisValues.set(versionKey!, String(currentVersion + 1));
  return currentVersion + 1;
});
const mockGetSharedRedis = jest.fn(() => ({
  mget: mockMget,
  del: mockDel,
  eval: mockEval
} as unknown as Redis));
const rows = [
  {
    companyId: 1,
    companySlug: 'northwind-bakery',
    companyName: 'Northwind Bakery',
    storeNumber: '413',
    storeName: 'Store 413',
    vpName: null,
    vpEmail: null,
    directorName: null,
    directorEmail: null,
    districtManagerName: 'Manager',
    districtManagerEmail: 'manager@northwind.co',
    ownerName: null,
    ownerEmail: null
  }
];
let databaseRows = rows;
const mockSelect = jest.fn(() => queryBuilder);

const queryBuilder: Record<string, (...args: unknown[]) => unknown> = {};
queryBuilder.from = () => queryBuilder;
queryBuilder.innerJoin = () => queryBuilder;
queryBuilder.where = () => queryBuilder;
queryBuilder.orderBy = async () => databaseRows;

await jest.unstable_mockModule('../../../src/config/redis.config.js', () => ({
  getSharedRedis: mockGetSharedRedis
}));
await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
  db: { select: mockSelect }
}));

const cache = await import('../../../src/modules/store-directory/store-directory.cache.js');
const { storeDirectoryRepository } = await import(
  '../../../src/modules/store-directory/store-directory.repository.js'
);

describe('store-directory Redis cache', () => {
  beforeEach(() => {
    redisValues.clear();
    evalCalls.length = 0;
    mockMget.mockClear();
    mockDel.mockClear();
    mockEval.mockClear();
    mockSelect.mockClear();
    databaseRows = rows;
  });

  it('uses cached store rows without another repository query', async () => {
    const first = await storeDirectoryRepository.findStoresByNumber('413');
    const second = await storeDirectoryRepository.findStoresByNumber('413');

    expect(first).toEqual(rows);
    expect(second).toEqual(rows);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'hr:cache:directory:version',
      cache.storeLookupCacheKey('413'),
      '0',
      expect.any(String),
      String(cache.STORE_DIRECTORY_CACHE_TTL_SECONDS)
    );
  });

  it('falls back to PostgreSQL on a malformed value and negatively caches misses briefly', async () => {
    const malformedKey = cache.storeLookupCacheKey('413');
    redisValues.set(malformedKey, '{broken');

    await storeDirectoryRepository.findStoresByNumber('413');
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith(malformedKey);

    databaseRows = [];
    await storeDirectoryRepository.findStoresByNumber('missing');
    await storeDirectoryRepository.findStoresByNumber('missing');
    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(mockEval).toHaveBeenLastCalledWith(
      expect.any(String),
      2,
      'hr:cache:directory:version',
      cache.storeLookupCacheKey('missing'),
      '0',
      expect.any(String),
      String(cache.STORE_DIRECTORY_NEGATIVE_CACHE_TTL_SECONDS)
    );
  });

  it('bypasses cache failures and continues through the PostgreSQL path', async () => {
    mockMget.mockRejectedValueOnce(new Error('Redis unavailable'));

    const result = await storeDirectoryRepository.findStoresByNumber('413');

    expect(result).toEqual(rows);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('invalidates store and CC entries by generation while preserving unrelated Redis keys', async () => {
    await cache.writeDirectoryCache(cache.storeLookupCacheKey('413'), 0, rows, 600);
    await cache.writeDirectoryCache(cache.ccRecipientsCacheKey('413'), 0, { matches: [] }, 600);
    redisValues.set('hr:other-service:key', 'keep-me');

    await cache.invalidateStoreDirectoryCaches();
    const storeAfterInvalidation = await cache.readDirectoryCache(
      cache.storeLookupCacheKey('413'),
      (value): value is typeof rows => Array.isArray(value)
    );
    const ccAfterInvalidation = await cache.readDirectoryCache(
      cache.ccRecipientsCacheKey('413'),
      (value): value is { matches: unknown[] } =>
        Boolean(value && typeof value === 'object' && 'matches' in value)
    );

    expect(storeAfterInvalidation.value).toBeNull();
    expect(ccAfterInvalidation.value).toBeNull();
    expect(redisValues.get('hr:other-service:key')).toBe('keep-me');
    expect(redisValues.get('hr:cache:directory:version')).toBe('1');
  });
});
