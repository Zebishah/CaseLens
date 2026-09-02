import {
  resolveEmployeeManualReview,
  resolveEmployeeMentionStatus
} from '../../../src/modules/employee/employee.mention-status.util.js';
import { retainExtractedNameAfterResolution } from '../../../src/modules/employee/employee.mention-validation.util.js';

describe('employee.mention-status.util', () => {
  it('marks screenshot-style subjects as no employee mentioned', () => {
    expect(
      resolveEmployeeMentionStatus({
        extractedNameCount: 0,
        resolvedMatchCount: 0,
        hadAmbiguousResolution: false,
        hadUnresolvedResolution: false
      })
    ).toBe('no_employee_mentioned');
  });

  it('keeps unresolved one-word person names and drops typo tokens', () => {
    expect(retainExtractedNameAfterResolution('Ayesha Khan', 'unresolved')).toBe(true);
    expect(retainExtractedNameAfterResolution('Braden', 'unresolved')).toBe(true);
    expect(retainExtractedNameAfterResolution('Si', 'unresolved')).toBe(false);
    expect(retainExtractedNameAfterResolution('Cher', 'resolved')).toBe(true);
  });

  it('does not require manual review when no employee is mentioned', () => {
    expect(
      resolveEmployeeManualReview({
        mentionStatus: 'no_employee_mentioned',
        employeeMatchCount: 0,
        topConfidence: 0,
        manualReviewConfidence: 60
      })
    ).toBe(false);
  });

  it('requires review for unresolved and ambiguous mentions', () => {
    expect(
      resolveEmployeeManualReview({
        mentionStatus: 'unresolved',
        employeeMatchCount: 0,
        topConfidence: 0,
        manualReviewConfidence: 60
      })
    ).toBe(true);
    expect(
      resolveEmployeeManualReview({
        mentionStatus: 'ambiguous',
        employeeMatchCount: 0,
        topConfidence: 0,
        manualReviewConfidence: 60
      })
    ).toBe(true);
  });

  it('keeps an operator-confirmed review flag until explicit re-analysis', () => {
    expect(
      resolveEmployeeManualReview({
        mentionStatus: 'no_employee_mentioned',
        employeeMatchCount: 0,
        topConfidence: 0,
        manualReviewConfidence: 60,
        operatorConfirmed: true,
        existingRequiresManualReview: true
      })
    ).toBe(true);
  });
});
