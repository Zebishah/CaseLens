import { describe, expect, it } from '@jest/globals';
import { CANVAS_COPY } from '../../../src/constants/canvas.constants.js';
import { canvasBuilder } from '../../../src/modules/canvas/canvas.builder.js';
import type { CanvasResponse } from '../../../src/modules/canvas/canvas.types.js';
import type { IntelligenceSnapshot } from '../../../src/types/intelligence.types.js';

const assertSupportedCanvas = (response: CanvasResponse): void => {
  expect(response).toEqual(
    expect.objectContaining({
      canvas: expect.objectContaining({
        content: expect.objectContaining({
          components: expect.any(Array)
        })
      })
    })
  );
  expect(response.canvas.content.components.length).toBeGreaterThan(0);
  const serialized = JSON.stringify(response);
  expect(serialized).not.toMatch(/sk-|AIza|BEGIN PRIVATE|gemini-api-key/i);
  expect(serialized.toLowerCase()).not.toContain('prompt:');
};

const readySnapshot = (overrides: Partial<IntelligenceSnapshot> = {}): IntelligenceSnapshot => ({
  caseType: 'attendance',
  employeeMatches: [
    {
      employeeIdentityId: 4,
      canonicalName: 'Jordan Hale',
      confidenceScore: 96,
      matchMethod: 'exact'
    }
  ],
  relatedCases: [
    {
      conversationId: 9,
      intercomId: 'rel-9',
      subject: 'Attendance — Jordan Hale',
      caseType: 'attendance',
      matchedEmployeeNames: ['Jordan Hale'],
      reporterName: 'Store 1042 Manager',
      status: 'open',
      advisorName: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    }
  ],
  requiresManualReview: false,
  intelligenceVersion: '11:1:1756684800000',
  processedAt: '2026-09-01T12:00:00.000Z',
  ...overrides
});

describe('Canvas Kit contract (local, never contacts Intercom)', () => {
  it('configure state', () => {
    const canvas = canvasBuilder.buildConfigure();
    assertSupportedCanvas(canvas);
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.APP_CONNECTED);
  });

  it('conversation not ingested yet', () => {
    assertSupportedCanvas(canvasBuilder.buildNotSynced());
  });

  it('processing queued / pending', () => {
    assertSupportedCanvas(canvasBuilder.buildPending({ reporterName: 'Store 1042 Manager' }));
  });

  it('processing active / updating', () => {
    assertSupportedCanvas(canvasBuilder.buildUpdatingIntelligence(null));
  });

  it('intelligence ready with compact system state and match evidence', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(readySnapshot());
    assertSupportedCanvas(canvas);
    const text = JSON.stringify(canvas);
    expect(text).toContain('Jordan Hale');
    expect(text).toContain('Matched');
    expect(text).toContain(CANVAS_COPY.RELATED_LINK_EVIDENCE_PREFIX);
    expect(text).toContain(CANVAS_COPY.PROCESSING_VERSION_PREFIX);
    expect(text).toContain(CANVAS_COPY.LAST_UPDATED_PREFIX);
    expect(text).toContain(CANVAS_COPY.IDENTITY_EVIDENCE_PREFIX);
    expect(text).not.toContain('exact · 100%');
  });

  it('includes an exact dashboard deep link when the Canvas has a persisted case id', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(readySnapshot(), { caseId: 42 });
    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'button',
          id: 'open-hr-intelligence-case',
          label: 'Open in HR Intelligence',
          action: { type: 'url', url: expect.stringContaining('/cases/42') }
        })
      ])
    );
  });

  it('low confidence / manual review', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      readySnapshot({
        requiresManualReview: true,
        employeeMatches: [
          {
            employeeIdentityId: 4,
            canonicalName: 'Jordan',
            confidenceScore: 42,
            matchMethod: 'fuzzy'
          }
        ]
      })
    );
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.MANUAL_REVIEW);
  });

  it('employee not found', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      readySnapshot({ employeeMatches: [], relatedCases: [] })
    );
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED);
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.NO_RELATED_CASES_NO_EMPLOYEE);
  });

  it('multiple possible employees', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      readySnapshot({
        employeeMatches: [
          {
            employeeIdentityId: 4,
            canonicalName: 'Jordan Hale',
            confidenceScore: 70,
            matchMethod: 'token'
          },
          {
            employeeIdentityId: 8,
            canonicalName: 'Jordan Hale',
            confidenceScore: 68,
            matchMethod: 'fuzzy'
          }
        ],
        requiresManualReview: true
      })
    );
    const text = JSON.stringify(canvas);
    expect(text).toContain('Jordan Hale');
    expect(text).toContain(CANVAS_COPY.MANUAL_REVIEW);
  });

  it('no related cases', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(readySnapshot({ relatedCases: [] }));
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.NO_RELATED_CASES);
  });

  it('processing failed', () => {
    const canvas = canvasBuilder.buildFailed('Gemini timed out');
    assertSupportedCanvas(canvas);
    const text = JSON.stringify(canvas);
    expect(text).toContain(CANVAS_COPY.FAILED);
    expect(text).toContain(CANVAS_COPY.FAILED_DETAIL);
    expect(text).not.toContain('Gemini timed out');
  });

  it('Intercom synchronization failed', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(readySnapshot(), {
      intercomSyncFailed: true
    });
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.INTERCOM_SYNC_FAILED);
  });

  it('Intercom disabled', () => {
    const canvas = canvasBuilder.buildDisabled();
    assertSupportedCanvas(canvas);
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.INTERCOM_DISABLED);
  });

  it('operator-corrected fields', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      readySnapshot({ operatorConfirmedFields: ['caseType', 'employee'] })
    );
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.OPERATOR_CORRECTED);
  });

  it('stale intelligence being replaced', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(readySnapshot(), {
      banner: 'pending-update'
    });
    expect(JSON.stringify(canvas)).toContain(CANVAS_COPY.UPDATES_PENDING);
  });
});
