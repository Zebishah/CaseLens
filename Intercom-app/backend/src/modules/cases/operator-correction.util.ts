import { EMPLOYEE_MATCH_METHOD } from '../../constants/intelligence.constants.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';

export const OPERATOR_CORRECTION_FIELDS = [
  'caseType',
  'storeNumber',
  'store',
  'employee',
  'stakeholders',
  'manualReview',
  'requiresManualReview'
] as const;

export type OperatorCorrectionField = (typeof OPERATOR_CORRECTION_FIELDS)[number];

const canonicalFieldName = (fieldName: string): string => {
  if (fieldName === 'store') {
    return 'storeNumber';
  }
  if (fieldName === 'requiresManualReview') {
    return 'manualReview';
  }
  return fieldName;
};

export const isOperatorCorrectionField = (fieldName: string): boolean =>
  (OPERATOR_CORRECTION_FIELDS as readonly string[]).includes(fieldName);

export const mergeOperatorConfirmedFields = (
  existing: string[] | undefined,
  fieldName: string
): string[] => {
  const canonical = canonicalFieldName(fieldName);
  const next = new Set(existing ?? []);
  next.add(canonical);
  return [...next];
};

const parseManualReview = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'manual';
};

export const applyOperatorCorrectionToSnapshot = (
  snapshot: IntelligenceSnapshot | null | undefined,
  fieldName: string,
  correctedValue: string
): IntelligenceSnapshot => {
  const base: IntelligenceSnapshot = snapshot
    ? { ...snapshot }
    : {
        employeeMatches: [],
        relatedCases: [],
        processedAt: new Date().toISOString()
      };

  const confirmed = mergeOperatorConfirmedFields(base.operatorConfirmedFields, fieldName);
  const canonical = canonicalFieldName(fieldName);

  if (canonical === 'caseType') {
    base.caseType = correctedValue.trim();
  }

  if (canonical === 'employee') {
    const name = correctedValue.trim();
    const current = base.employeeMatches[0];
    if (current) {
      base.employeeMatches = [
        {
          ...current,
          canonicalName: name,
          matchMethod: EMPLOYEE_MATCH_METHOD.MANUAL,
          confidenceScore: 100
        },
        ...base.employeeMatches.slice(1)
      ];
    } else {
      base.employeeMatches = [
        {
          employeeIdentityId: 0,
          canonicalName: name,
          confidenceScore: 100,
          matchMethod: EMPLOYEE_MATCH_METHOD.MANUAL
        }
      ];
    }
  }

  if (canonical === 'manualReview') {
    base.requiresManualReview = parseManualReview(correctedValue);
  }

  if (canonical === 'stakeholders') {
    const emails = correctedValue
      .split(',')
      .map((entry) => entry.trim())
      .filter((email) => email.includes('@'));
    base.ccRecipients = {
      status: 'ok',
      storeNumber: base.ccRecipients && 'storeNumber' in base.ccRecipients
        ? (base.ccRecipients.storeNumber ?? '')
        : '',
      companyName:
        base.ccRecipients && 'companyName' in base.ccRecipients
          ? (base.ccRecipients.companyName ?? 'Manual')
          : 'Manual',
      recipients: emails.map((email) => ({
        email,
        name: email,
        role: 'manual',
        source: 'fixed' as const
      })),
      message: null
    };
  }

  base.operatorConfirmedFields = confirmed;
  return base;
};
