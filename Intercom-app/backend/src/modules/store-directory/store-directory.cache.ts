import { createHash } from 'node:crypto';
import { logger } from '../../config/logger.config.js';
import { getSharedRedis } from '../../config/redis.config.js';
import { operationalMetrics } from '../../observability/metrics.js';

export const STORE_DIRECTORY_CACHE_TTL_SECONDS = 10 * 60;
export const STORE_DIRECTORY_NEGATIVE_CACHE_TTL_SECONDS = 45;
export const CC_RECIPIENT_CACHE_TTL_SECONDS = 10 * 60;
export const CC_RECIPIENT_NEGATIVE_CACHE_TTL_SECONDS = 45;

const DIRECTORY_CACHE_VERSION_KEY = 'hr:cache:directory:version';
const CACHE_WRITE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;
const CACHE_INVALIDATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local current = tonumber(raw or '0')
if not current or current < 0 or current % 1 ~= 0 or (raw and not string.match(raw, '^%d+$')) then
  redis.call('SET', KEYS[1], '1')
  return 1
end
return redis.call('INCR', KEYS[1])
`;
const CACHE_LOG_COOLDOWN_MS = 60_000;
let lastCacheWarningAt = 0;

const logCacheFailure = (operation: string): void => {
  const now = Date.now();
  if (lastCacheWarningAt + CACHE_LOG_COOLDOWN_MS > now) return;
  lastCacheWarningAt = now;
  logger.warn('[redis] Store-directory cache operation failed; using PostgreSQL', {
    operation
  });
};

const hashCacheIdentity = (identity: string): string =>
  createHash('sha256').update(identity).digest('hex');

export const storeLookupCacheKey = (storeNumber: string): string =>
  `hr:cache:store:${hashCacheIdentity(storeNumber)}`;

export const ccRecipientsCacheKey = (storeNumber: string): string =>
  `hr:cache:cc:${hashCacheIdentity(storeNumber)}`;

export type DirectoryCacheRead<T> = {
  version: number;
  value: T | null;
};

/** Return a cache value only when its directory generation is current. */
export const readDirectoryCache = async <T>(
  key: string,
  isValid: (value: unknown) => value is T
): Promise<DirectoryCacheRead<T>> => {
  try {
    const redis = getSharedRedis();
    if (!redis) {
      operationalMetrics.cacheBypass();
      return { version: 0, value: null };
    }
    const [rawVersion, rawValue] = await redis.mget(DIRECTORY_CACHE_VERSION_KEY, key);
    const parsedVersion = rawVersion === null ? 0 : Number(rawVersion);
    if (
      !Number.isSafeInteger(parsedVersion) ||
      parsedVersion < 0 ||
      (rawVersion !== null && !/^\d+$/.test(rawVersion))
    ) {
      logCacheFailure('invalid-generation');
      return { version: 0, value: null };
    }
    const version = parsedVersion;

    if (rawValue === null) {
      operationalMetrics.cacheMiss();
      return { version, value: null };
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(rawValue);
    } catch {
      await redis.del(key).catch(() => undefined);
      logCacheFailure('malformed-value');
      operationalMetrics.cacheMiss();
      return { version, value: null };
    }

    if (
      !envelope ||
      typeof envelope !== 'object' ||
      !('version' in envelope) ||
      !('data' in envelope) ||
      envelope.version !== version ||
      !isValid(envelope.data)
    ) {
      await redis.del(key).catch(() => undefined);
      if (!envelope || typeof envelope !== 'object' || !('version' in envelope) || !('data' in envelope)) {
        logCacheFailure('invalid-value');
      }
      operationalMetrics.cacheMiss();
      return { version, value: null };
    }

    operationalMetrics.cacheHit();
    return { version, value: envelope.data };
  } catch {
    logCacheFailure('read');
    operationalMetrics.cacheBypass();
    return { version: 0, value: null };
  }
};

/** Store only if no directory write happened while the database read was in flight. */
export const writeDirectoryCache = async <T>(
  key: string,
  version: number,
  data: T,
  ttlSeconds: number
): Promise<void> => {
  try {
    const redis = getSharedRedis();
    if (!redis) {
      operationalMetrics.cacheBypass();
      return;
    }
    await redis.eval(
      CACHE_WRITE_SCRIPT,
      2,
      DIRECTORY_CACHE_VERSION_KEY,
      key,
      String(version),
      JSON.stringify({ version, data }),
      String(ttlSeconds)
    );
  } catch {
    logCacheFailure('write');
    operationalMetrics.cacheBypass();
  }
};

/** Bump one version after the PostgreSQL transaction commits; old cache values expire by TTL. */
export const invalidateStoreDirectoryCaches = async (): Promise<void> => {
  try {
    const redis = getSharedRedis();
    if (!redis) return;
    await redis.eval(CACHE_INVALIDATE_SCRIPT, 1, DIRECTORY_CACHE_VERSION_KEY);
  } catch {
    logCacheFailure('invalidation');
  }
};
