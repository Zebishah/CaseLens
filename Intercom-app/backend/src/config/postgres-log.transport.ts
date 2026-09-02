import Transport from 'winston-transport';
import { env } from './env.config.js';

type LogInfo = {
  level: string;
  message: unknown;
  timestamp?: string;
  stack?: string;
  [key: string]: unknown;
};

/** DB persistence is error-only — warn/info stay on console/files to avoid log table blowups. */
const PERSISTED_LEVELS = new Set(['error']);
const MAX_META_CHARS = 8_000;

/**
 * Expected/transient noise we already handle in-process. Do not fill Postgres with these.
 * Console + file logs still capture them when LOG_LEVEL allows.
 */
const NOISE_ERROR_PATTERNS: RegExp[] = [
  /\[database\] Idle client error/i,
  /\[queue\].*connection error/i,
  /\[worker\].*connection error/i,
  /\[redis\].*connection/i,
  /\[process\] Uncaught exception.*EIO/i,
  /EIO:\s*i\/o error,\s*write/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /read ECONNRESET/i,
  /Connection is closed/i,
  /Connection terminated unexpectedly/i
];

const toPlainMessage = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
};

const isNoisyTransientError = (level: string, message: string, info: LogInfo): boolean => {
  if (level !== 'error') {
    return false;
  }

  const code =
    typeof info.code === 'string'
      ? info.code
      : info.error && typeof info.error === 'object' && 'code' in (info.error as object)
        ? String((info.error as { code?: unknown }).code ?? '')
        : '';

  if (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'EIO'
  ) {
    return true;
  }

  return NOISE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const sanitizeMeta = (info: LogInfo): Record<string, unknown> | null => {
  const {
    level: _level,
    message: _message,
    timestamp: _timestamp,
    splat: _splat,
    Symbol: _symbol,
    ...rest
  } = info;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (typeof key === 'symbol' || key.startsWith('Symbol(')) {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    if (value instanceof Error) {
      cleaned[key] = {
        message: value.message,
        stack: value.stack,
        code: (value as NodeJS.ErrnoException).code
      };
      continue;
    }

    cleaned[key] = value;
  }

  if (Object.keys(cleaned).length === 0) {
    return null;
  }

  try {
    const serialized = JSON.stringify(cleaned);
    if (serialized.length <= MAX_META_CHARS) {
      return cleaned;
    }

    return {
      truncated: true,
      preview: serialized.slice(0, MAX_META_CHARS)
    };
  } catch {
    return { note: 'meta could not be serialized' };
  }
};

const pickContextId = (
  meta: Record<string, unknown> | null,
  keys: string[]
): string | null => {
  if (!meta) {
    return null;
  }

  for (const key of keys) {
    const value = meta[key];
    if (value === null || value === undefined) {
      continue;
    }

    const asString = String(value).trim();
    if (asString) {
      return asString.slice(0, 64);
    }
  }

  return null;
};

/**
 * Writes important error logs to Postgres asynchronously.
 * Warn/info are not persisted (console/file only).
 * Uses dynamic imports to avoid circular deps with database/connection (which uses logger).
 * Never throws into Winston — failures go to console only.
 */
export class PostgresLogTransport extends Transport {
  log(info: LogInfo, callback: () => void): void {
    setImmediate(() => {
      callback();
    });

    if (env.NODE_ENV === 'test' && process.env.TEST_DB_LOG_TRANSPORT !== '1') {
      return;
    }

    const level = String(info.level ?? '')
      // Strip ANSI color codes Winston may leave on the level field.
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[[0-9;]*m/g, '')
      .toLowerCase();

    if (!PERSISTED_LEVELS.has(level)) {
      return;
    }

    const message = toPlainMessage(info.message);
    if (message.includes('[app-logs]')) {
      return;
    }

    if (isNoisyTransientError(level, message, info)) {
      return;
    }

    void this.persist(level, message, info);
  }

  private async persist(level: string, message: string, info: LogInfo): Promise<void> {
    try {
      const [{ db }, { appLogs }] = await Promise.all([
        import('../database/connection.js'),
        import('../database/schema/app_logs.js')
      ]);

      const meta = sanitizeMeta(info);
      const conversationId = pickContextId(meta, [
        'conversationId',
        'conversation_id'
      ]);
      const intercomId = pickContextId(meta, ['intercomId', 'intercom_id']);

      await db.insert(appLogs).values({
        level,
        message: message.slice(0, 8_000),
        meta,
        conversationId,
        intercomId
      });
    } catch (error) {
      // Never use logger here — would recurse / crash if DB is down.
      console.error('[app-logs] Failed to persist log to database', {
        level,
        message: message.slice(0, 200),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
