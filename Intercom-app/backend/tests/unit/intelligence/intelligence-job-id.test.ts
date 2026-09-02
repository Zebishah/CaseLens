import { describe, expect, it } from '@jest/globals';
import {
  buildIntelligenceJobId,
  revisionKeyFromSource
} from '../../../src/modules/intelligence/intelligence-revision.util.js';

describe('revision-aware BullMQ job ids', () => {
  it('keeps the same job id for a duplicate notification of the same source revision', () => {
    const revision = revisionKeyFromSource(1, new Date('2026-09-01T00:00:00.000Z'));
    expect(buildIntelligenceJobId(11, revision)).toBe(buildIntelligenceJobId(11, revision));
  });

  it('uses a different job id when Intercom updated_at advances (new user reply)', () => {
    const first = buildIntelligenceJobId(
      11,
      revisionKeyFromSource(1, new Date('2026-09-01T00:00:00.000Z'))
    );
    const second = buildIntelligenceJobId(
      11,
      revisionKeyFromSource(1, new Date('2026-09-01T01:00:00.000Z'))
    );
    expect(first).not.toBe(second);
    expect(first).toMatch(/^intelligence-11-r/);
    expect(second).toMatch(/^intelligence-11-r/);
  });

  it('proves a conversation-only job id would collide across revisions', () => {
    const conversationOnly = 'intelligence-11';
    expect(conversationOnly).toBe('intelligence-11');
    expect(
      buildIntelligenceJobId(11, revisionKeyFromSource(1, new Date('2026-09-01T00:00:00.000Z')))
    ).not.toBe(
      buildIntelligenceJobId(11, revisionKeyFromSource(1, new Date('2026-09-01T01:00:00.000Z')))
    );
  });
});
