import { describe, expect, it } from '@jest/globals';
import {
  buildIntelligenceJobId,
  buildIntelligenceVersion,
  isStaleIntelligencePersist,
  laterTimestamp,
  parseIntercomUnixTimestamp,
  revisionKeyFromSource
} from '../../../src/modules/intelligence/intelligence-revision.util.js';

describe('intelligence-revision.util', () => {
  it('parses Intercom unix seconds', () => {
    expect(parseIntercomUnixTimestamp(1_700_000_000)?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('keeps the later source revision', () => {
    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-02-01T00:00:00.000Z');
    expect(laterTimestamp(older, newer)).toEqual(newer);
    expect(laterTimestamp(newer, older)).toEqual(newer);
  });

  it('builds a stable intelligence version key', () => {
    const at = new Date('2026-09-01T00:00:00.000Z');
    expect(buildIntelligenceVersion({ conversationId: 11, messageCount: 3, sourceUpdatedAt: at })).toBe(
      `11:3:${at.getTime()}`
    );
  });

  it('detects a stale persist when messages grew', () => {
    expect(
      isStaleIntelligencePersist({
        runMessageCount: 1,
        currentMessageCount: 2,
        runSourceUpdatedAt: new Date('2026-01-01'),
        currentSourceUpdatedAt: new Date('2026-01-01')
      })
    ).toBe(true);
  });

  it('detects a stale persist when Intercom updated_at moved forward', () => {
    expect(
      isStaleIntelligencePersist({
        runMessageCount: 2,
        currentMessageCount: 2,
        runSourceUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
        currentSourceUpdatedAt: new Date('2026-01-02T00:00:00.000Z')
      })
    ).toBe(true);
  });

  it('allows persist when the run matches the current revision', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    expect(
      isStaleIntelligencePersist({
        runMessageCount: 2,
        currentMessageCount: 2,
        runSourceUpdatedAt: at,
        currentSourceUpdatedAt: at
      })
    ).toBe(false);
  });

  it('builds revision-aware job ids', () => {
    expect(buildIntelligenceJobId(11, '1-1000')).toBe('intelligence-11-r1-1000');
    expect(buildIntelligenceJobId(11, revisionKeyFromSource(1, new Date(1000)))).not.toBe(
      buildIntelligenceJobId(11, revisionKeyFromSource(1, new Date(2000)))
    );
  });
});
