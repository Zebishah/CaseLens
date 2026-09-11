import { describe, expect, it } from '@jest/globals';
import { buildIntercomIntelligenceNote } from '../../../src/modules/intercom/intercom.sync.util.js';
import type { IntelligenceSnapshot } from '../../../src/types/intelligence.types.js';

const snapshot = (overrides?: Partial<IntelligenceSnapshot>): IntelligenceSnapshot => ({
  employeeMatches: [
    {
      employeeIdentityId: 1,
      canonicalName: 'Jordan Hale',
      confidenceScore: 92,
      matchMethod: 'exact'
    }
  ],
  relatedCases: [{ conversationId: 2, intercomId: '99', subject: 'Prior', caseType: 'attendance', matchedEmployeeNames: ['Jordan Hale'], reporterName: null, status: 'closed', advisorName: null, createdAt: '2026-01-01' }],
  processedAt: '2026-09-01T00:00:00.000Z',
  caseType: 'attendance',
  requiresManualReview: false,
  ccRecipients: {
    status: 'ok',
    storeNumber: '1042',
    companyName: 'Northwind',
    recipients: [{ name: 'Sam Patel', email: 'sam@northwind.co', role: 'DM', source: 'store' }],
    message: null
  },
  ...overrides
});

describe('intercom.sync.util', () => {
  it('builds a concise note and stable fingerprint', () => {
    const first = buildIntercomIntelligenceNote({ reporterStoreNumber: '1042', companyName: 'Northwind' }, snapshot());
    const second = buildIntercomIntelligenceNote({ reporterStoreNumber: '1042', companyName: 'Northwind' }, snapshot());

    expect(first.body).toContain('Jordan Hale');
    expect(first.body).toContain('Related cases: 1');
    expect(first.body).toContain('Sam Patel');
    expect(first.tags).toEqual([
      'hr-intelligence-processed',
      'employee-matched',
      'related-cases-found',
      'category-attendance'
    ]);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.marker).toContain('sync:');
  });

  it('does not write a false employee identity when none was mentioned', () => {
    const note = buildIntercomIntelligenceNote(
      { reporterStoreNumber: null, companyName: null },
      snapshot({
        employeeMatches: [],
        employeeMentionStatus: 'no_employee_mentioned',
        relatedCases: [],
        caseType: 'general',
        requiresManualReview: false,
        ccRecipients: undefined
      })
    );

    expect(note.body).toContain('Employee: No employee identified');
    expect(note.body).toContain('Confidence: —');
    expect(note.body).toContain('Status: No explicit employee name in subject');
    expect(note.body).toContain('Store: —');
    expect(note.body).toContain('Category: General');
    expect(note.body).toContain('Related cases: 0');
    expect(note.body).toContain('Stakeholder: —');
    expect(note.body).toContain('Review required: No');
    expect(note.body).toContain('AI assists; humans decide.');
    expect(note.body).not.toContain('First Intercom');
    expect(note.body).not.toContain('Employee mentioned: Si');
    expect(note.body).not.toContain('100%');
  });

  it('counts spelling-related cases in the note when the directory has no match', () => {
    const note = buildIntercomIntelligenceNote(
      { reporterStoreNumber: null, companyName: null },
      snapshot({
        employeeMatches: [],
        employeeMentionStatus: 'unresolved',
        unresolvedEmployeeMention: 'Braden',
        relatedCases: [],
        fuzzyRelatedCases: [
          {
            conversationId: 6,
            intercomId: '215475747334934',
            subject: 'Braeden is talking shit in office and handling work badly',
            caseType: 'conduct',
            matchedEmployeeNames: ['Braeden'],
            reporterName: null,
            status: 'open',
            advisorName: null,
            createdAt: '2026-09-02T09:00:00.000Z',
            fuzzyMatchScore: 86,
            fuzzyMatchedName: 'Braeden',
            fuzzySharedTokens: ['braden~braeden']
          }
        ],
        caseType: 'conduct',
        requiresManualReview: true,
        ccRecipients: undefined
      })
    );

    expect(note.body).toContain('Employee: Braden');
    expect(note.body).toContain('Related cases: 1');
  });

  it('changes fingerprint when identity changes', () => {
    const first = buildIntercomIntelligenceNote({ reporterStoreNumber: '1042', companyName: null }, snapshot());
    const second = buildIntercomIntelligenceNote(
      { reporterStoreNumber: '1042', companyName: null },
      snapshot({ employeeMatches: [] })
    );
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it('escapes operator-visible values in the Intercom note', () => {
    const note = buildIntercomIntelligenceNote(
      { reporterStoreNumber: '<1042>', companyName: 'Northwind' },
      snapshot({
        employeeMatches: [{ employeeIdentityId: 1, canonicalName: '<Jordan>', confidenceScore: 92, matchMethod: 'exact' }],
        ccRecipients: {
          status: 'ok',
          storeNumber: '1042',
          companyName: 'Northwind',
          recipients: [{ name: '<Sam>', email: 'sam@example.com', role: 'DM', source: 'store' }],
          message: null
        }
      })
    );

    expect(note.body).toContain('&lt;Jordan&gt;');
    expect(note.body).toContain('&lt;1042&gt;');
    expect(note.body).not.toContain('<Jordan>');
    expect(note.body).not.toContain('<Sam>');
  });
});
