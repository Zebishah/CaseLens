import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';
import { resolveCanvasSnapshotBanner } from '../../../src/modules/canvas/canvas-snapshot-banner.util.js';

describe('resolveCanvasSnapshotBanner', () => {
  const baseSnapshot = {
    employeeMatches: [
      {
        employeeIdentityId: 1,
        canonicalName: 'Ahsan',
        confidenceScore: 100,
        matchMethod: 'exact'
      }
    ],
    relatedCases: [],
    messageCount: 1,
    processedSubject: 'Attendance issue - ahsan',
    processedAt: '2026-01-01T00:00:00.000Z'
  };

  it('returns current when snapshot matches current subject and status is ready', () => {
    expect(
      resolveCanvasSnapshotBanner({
        id: 1,
        intelligenceStatus: INTELLIGENCE_STATUS.READY,
        subject: 'Attendance issue - ahsan',
        rawPayload: null,
        intelligenceSnapshot: baseSnapshot
      } as never)
    ).toBe('current');
  });

  it('returns refresh-pending when intelligence is pending without subject drift', () => {
    expect(
      resolveCanvasSnapshotBanner({
        id: 1,
        intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
        subject: 'Attendance issue - ahsan',
        rawPayload: null,
        intelligenceSnapshot: baseSnapshot
      } as never)
    ).toBe('refresh-pending');
  });

  it('returns pending-update when stored subject drifted from processed subject', () => {
    expect(
      resolveCanvasSnapshotBanner({
        id: 1,
        intelligenceStatus: INTELLIGENCE_STATUS.READY,
        subject: 'Attendance issue - miyabi',
        rawPayload: null,
        intelligenceSnapshot: baseSnapshot
      } as never)
    ).toBe('pending-update');
  });

  it('prefers live subject from Intercom initialize payload over stored DB subject', () => {
    expect(
      resolveCanvasSnapshotBanner(
        {
          id: 1,
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Attendance issue - ahsan',
          rawPayload: null,
          intelligenceSnapshot: baseSnapshot
        } as never,
        { liveSubject: 'Attendance issue - miyabi' }
      )
    ).toBe('pending-update');
  });

  it('returns current when live subject matches processed subject even if DB subject drifted', () => {
    expect(
      resolveCanvasSnapshotBanner(
        {
          id: 1,
          intelligenceStatus: INTELLIGENCE_STATUS.READY,
          subject: 'Attendance issue - old db value',
          rawPayload: null,
          intelligenceSnapshot: baseSnapshot
        } as never,
        { liveSubject: 'Attendance issue - ahsan' }
      )
    ).toBe('current');
  });
});
