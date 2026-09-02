import {
  addDismissedCategoryCaseIntercomId,
  addDismissedRelatedCaseIntercomId,
  buildDismissCategoryCaseComponentId,
  buildDismissRelatedCaseComponentId,
  filterDismissedCategoryCases,
  filterDismissedRelatedCases,
  parseDismissCategoryCaseComponentId,
  parseDismissRelatedCaseComponentId
} from '../../../src/modules/canvas/related-case-dismiss.util.js';

describe('related-case-dismiss.util', () => {
  it('builds and parses dismiss component ids', () => {
    const componentId = buildDismissRelatedCaseComponentId('215474091120045');

    expect(componentId).toBe('dismiss-related-215474091120045');
    expect(parseDismissRelatedCaseComponentId(componentId)).toBe('215474091120045');
    expect(parseDismissRelatedCaseComponentId('other')).toBeNull();
  });

  it('filters dismissed related cases by intercom id', () => {
    const relatedCases = [
      {
        conversationId: 2,
        intercomId: '111',
        subject: 'one',
        caseType: 'attendance',
        matchedEmployeeNames: ['A'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-06-10T00:00:00.000Z'
      },
      {
        conversationId: 3,
        intercomId: '222',
        subject: 'two',
        caseType: 'attendance',
        matchedEmployeeNames: ['B'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-06-10T00:00:00.000Z'
      }
    ];

    expect(filterDismissedRelatedCases(relatedCases, ['111'])).toHaveLength(1);
    expect(filterDismissedRelatedCases(relatedCases, ['111'])[0]?.intercomId).toBe('222');
  });

  it('adds dismissed ids without duplicates', () => {
    expect(addDismissedRelatedCaseIntercomId(['111'], '222')).toEqual(['111', '222']);
    expect(addDismissedRelatedCaseIntercomId(['111'], '111')).toEqual(['111']);
  });

  it('builds and parses category dismiss component ids', () => {
    const componentId = buildDismissCategoryCaseComponentId('215474091120099');

    expect(componentId).toBe('dismiss-category-215474091120099');
    expect(parseDismissCategoryCaseComponentId(componentId)).toBe('215474091120099');
    expect(parseDismissCategoryCaseComponentId('dismiss-related-111')).toBeNull();
  });

  it('filters dismissed category cases by intercom id', () => {
    const categoryCases = [
      {
        conversationId: 4,
        intercomId: '333',
        subject: 'three',
        caseType: 'coaching',
        matchedEmployeeNames: ['C'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-06-10T00:00:00.000Z'
      }
    ];

    expect(filterDismissedCategoryCases(categoryCases, ['333'])).toHaveLength(0);
    expect(addDismissedCategoryCaseIntercomId(undefined, '333')).toEqual(['333']);
  });
});
