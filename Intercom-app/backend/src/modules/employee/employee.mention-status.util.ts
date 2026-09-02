import type { EmployeeMentionStatus } from './employee.matching.service.js';

export const resolveEmployeeMentionStatus = (input: {
  extractedNameCount: number;
  resolvedMatchCount: number;
  hadAmbiguousResolution: boolean;
  hadUnresolvedResolution: boolean;
}): EmployeeMentionStatus => {
  if (input.extractedNameCount === 0) {
    return 'no_employee_mentioned';
  }

  if (input.resolvedMatchCount > 0) {
    return 'resolved';
  }

  if (input.hadAmbiguousResolution) {
    return 'ambiguous';
  }

  if (input.hadUnresolvedResolution) {
    return 'unresolved';
  }

  return 'unresolved';
};

export const resolveEmployeeManualReview = (input: {
  mentionStatus: EmployeeMentionStatus;
  employeeMatchCount: number;
  topConfidence: number;
  manualReviewConfidence: number;
  operatorConfirmed?: boolean;
  existingRequiresManualReview?: boolean;
}): boolean => {
  if (input.operatorConfirmed) {
    return Boolean(input.existingRequiresManualReview);
  }

  if (input.mentionStatus === 'unresolved' || input.mentionStatus === 'ambiguous') {
    return true;
  }

  if (input.mentionStatus === 'no_employee_mentioned') {
    return false;
  }

  return input.employeeMatchCount !== 1 || input.topConfidence < input.manualReviewConfidence;
};
