const privateFieldNames = new Set([
  'body',
  'description',
  'domain',
  'conversationbody',
  'email',
  'error',
  'errorbody',
  'extractedname',
  'gemininames',
  'keptnames',
  'message',
  'messagebody',
  'mentionednames',
  'names',
  'prompt',
  'issuesummary',
  'lasterror',
  'payload',
  'providermetadata',
  'rawpayload',
  'reporteremail',
  'reportername',
  'safemessage',
  'subject',
  'tophint',
  'canonicalname',
  'companydomain',
  'storenumber'
]);

const normalizeField = (key: string): string =>
  key.replace(/[_\s-]/g, '').toLowerCase();

const shouldRedactField = (key: string): boolean => {
  const normalized = normalizeField(key);
  return (
    privateFieldNames.has(normalized) ||
    normalized.startsWith('employeeidentity') ||
    normalized.startsWith('reporter') ||
    normalized.endsWith('email') ||
    normalized.endsWith('errorbody') ||
    normalized.endsWith('messagebody') ||
    normalized.endsWith('prompt') ||
    normalized.endsWith('names') ||
    normalized.endsWith('hint')
  );
};

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      shouldRedactField(key) ? '[redacted]' : sanitizeValue(nested)
    ])
  );
};

/** Remove HR content and employee details from logs emitted by the Actor runtime. */
export const redactApifyLogMetadata = <T extends Record<string, unknown>>(info: T): T => {
  const safe: Record<string, unknown> = { ...info };
  const splat = (info as Record<PropertyKey, unknown>)[Symbol.for('splat')];
  if (typeof safe['message'] === 'string' && Array.isArray(splat)) {
    let safeMessage = safe['message'];
    for (const value of splat) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      for (const [key, privateValue] of Object.entries(value)) {
        if (shouldRedactField(key) && typeof privateValue === 'string' && privateValue) {
          const suffix = ` ${privateValue}`;
          if (safeMessage.endsWith(suffix)) {
            safeMessage = `${safeMessage.slice(0, -suffix.length)} [redacted]`;
          }
        }
      }
    }
    safe.message = safeMessage;
  }
  for (const [key, value] of Object.entries(safe)) {
    if (key === 'level' || key === 'message' || key === 'timestamp') continue;
    safe[key] = shouldRedactField(key) ? '[redacted]' : sanitizeValue(value);
  }
  return safe as T;
};
