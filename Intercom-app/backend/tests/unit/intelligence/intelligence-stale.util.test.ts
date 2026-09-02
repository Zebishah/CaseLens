import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import { shouldReprocessIntelligence } from '../../../src/modules/intelligence/intelligence-stale.util.js';

describe('shouldReprocessIntelligence', () => {
  it('reprocesses when new messages arrive after a ready snapshot', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 1,
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(true);
  });

  it('does not reprocess when message count is unchanged', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Attendance - John Smith',
          intelligenceSnapshot: {
            employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'A', confidenceScore: 100, matchMethod: 'exact' }],
            relatedCases: [],
            messageCount: 4,
            processedSubject: 'Attendance - John Smith',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(false);
  });

  it('reprocesses when the Intercom subject changed since the last snapshot', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Attendance - zebi shah',
          intelligenceSnapshot: {
            employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'zebi shah', confidenceScore: 100, matchMethod: 'exact' }],
            relatedCases: [],
            messageCount: 4,
            processedSubject: 'bad attendance - zebi',
            extractionSource: 'gemini',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(true);
  });

  it('reprocesses legacy snapshots with no employees after the first message', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(true);
  });

  it('reprocesses ready snapshots that never stored an extraction source', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 1,
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        1
      )
    ).toBe(true);
  });

  it('does not reprocess an unresolved mention just because it has no directory match', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Braden is talking shit in office and handling work badly',
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            mentionedInReport: ['Braden'],
            employeeMentionStatus: 'unresolved',
            unresolvedEmployeeMention: 'Braden',
            messageCount: 1,
            processedSubject: 'Braden is talking shit in office and handling work badly',
            extractionSource: 'gemini',
            processedAt: '2026-09-02T00:00:00.000Z'
          }
        },
        1
      )
    ).toBe(false);
  });

  it('reprocesses when more employees were mentioned than matched', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 1, canonicalName: 'Hassan Memon', confidenceScore: 100, matchMethod: 'exact' }
            ],
            relatedCases: [],
            mentionedInReport: ['Hassan Memon', 'Ahsan Pervaiz'],
            messageCount: 1,
            extractionSource: 'gemini',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        1
      )
    ).toBe(true);
  });

  it('does not reprocess pending conversations that already have a current gemini snapshot', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
          subject: 'Attendance - Hassan Memon',
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 1, canonicalName: 'Hassan Memon', confidenceScore: 100, matchMethod: 'exact' }
            ],
            relatedCases: [],
            mentionedInReport: ['Hassan Memon'],
            messageCount: 4,
            processedSubject: 'Attendance - Hassan Memon',
            extractionSource: 'gemini',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(false);
  });

  it('reprocesses pending conversations when processedSubject is missing', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 1, canonicalName: 'Hassan Memon', confidenceScore: 100, matchMethod: 'exact' }
            ],
            relatedCases: [],
            mentionedInReport: ['Hassan Memon'],
            messageCount: 4,
            extractionSource: 'gemini',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        4
      )
    ).toBe(true);
  });

  it('reprocesses when a prior run stored fallback with no employees', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            messageCount: 1,
            extractionSource: 'fallback',
            processedAt: '2026-06-10T00:00:00.000Z'
          }
        },
        1
      )
    ).toBe(true);
  });

  it('does not reprocess when only Intercom notes or tags bump updated_at', () => {
    expect(
      shouldReprocessIntelligence(
        {
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Attendance - Jordan Hale',
          intercomSourceUpdatedAt: new Date('2026-09-01T01:00:00.000Z'),
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 1, canonicalName: 'Jordan Hale', confidenceScore: 100, matchMethod: 'exact' }
            ],
            relatedCases: [],
            messageCount: 1,
            processedSubject: 'Attendance - Jordan Hale',
            sourceRevision: '2026-09-01T00:00:00.000Z',
            processedAt: '2026-09-01T00:00:00.000Z'
          }
        },
        1
      )
    ).toBe(false);
  });
});
