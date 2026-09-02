export const parseIntercomUnixTimestamp = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms);
  }
  if (typeof value === 'string' && value.trim()) {
    if (/^\d+$/.test(value.trim())) {
      return parseIntercomUnixTimestamp(Number(value.trim()));
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
};

export const laterTimestamp = (left: Date | null | undefined, right: Date | null | undefined): Date | null => {
  if (!left) {
    return right ?? null;
  }
  if (!right) {
    return left;
  }
  return left.getTime() >= right.getTime() ? left : right;
};

export const buildIntelligenceVersion = (input: {
  conversationId: number;
  messageCount: number;
  sourceUpdatedAt?: Date | null;
}): string =>
  `${input.conversationId}:${input.messageCount}:${input.sourceUpdatedAt?.getTime() ?? 0}`;

export const isStaleIntelligencePersist = (input: {
  runMessageCount: number;
  currentMessageCount: number;
  runSourceUpdatedAt?: Date | null;
  currentSourceUpdatedAt?: Date | null;
}): boolean => {
  if (input.currentMessageCount > input.runMessageCount) {
    return true;
  }
  const runTs = input.runSourceUpdatedAt?.getTime() ?? 0;
  const currentTs = input.currentSourceUpdatedAt?.getTime() ?? 0;
  return currentTs > runTs;
};

/** BullMQ job id: unique per conversation + source revision so a waiting/active job cannot swallow a later reply. */
export const buildIntelligenceJobId = (conversationId: number, revisionKey: string): string => {
  const safe = revisionKey.replace(/[^a-zA-Z0-9._-]+/g, '').slice(0, 80) || '0';
  return `intelligence-${conversationId}-r${safe}`;
};

export const revisionKeyFromSource = (messageCount: number, sourceUpdatedAt?: Date | null): string =>
  `${messageCount}-${sourceUpdatedAt?.getTime() ?? 0}`;

