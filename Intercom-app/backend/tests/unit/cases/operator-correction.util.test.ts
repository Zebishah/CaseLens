import { describe, expect, it } from '@jest/globals';
import { EMPLOYEE_MATCH_METHOD } from '../../../src/constants/intelligence.constants.js';
import {
  applyOperatorCorrectionToSnapshot,
  isOperatorCorrectionField,
  mergeOperatorConfirmedFields
} from '../../../src/modules/cases/operator-correction.util.js';
import type { IntelligenceSnapshot } from '../../../src/types/intelligence.types.js';

const snapshot = (): IntelligenceSnapshot => ({
  caseType: 'attendance',
  employeeMatches: [
    {
      employeeIdentityId: 4,
      canonicalName: 'Jordan Hale',
      confidenceScore: 80,
      matchMethod: 'exact'
    }
  ],
  relatedCases: [],
  processedAt: '2026-09-01T00:00:00.000Z'
});

describe('operator corrections', () => {
  it('accepts supported fields only', () => {
    expect(isOperatorCorrectionField('caseType')).toBe(true);
    expect(isOperatorCorrectionField('prompt')).toBe(false);
  });

  it('persists a classification correction onto the snapshot', () => {
    const next = applyOperatorCorrectionToSnapshot(snapshot(), 'caseType', 'conduct');
    expect(next.caseType).toBe('conduct');
    expect(next.operatorConfirmedFields).toEqual(['caseType']);
  });

  it('marks an employee correction as manual and confirmed', () => {
    const next = applyOperatorCorrectionToSnapshot(snapshot(), 'employee', 'Riley Chen');
    expect(next.employeeMatches[0]?.canonicalName).toBe('Riley Chen');
    expect(next.employeeMatches[0]?.matchMethod).toBe(EMPLOYEE_MATCH_METHOD.MANUAL);
    expect(next.operatorConfirmedFields).toContain('employee');
  });

  it('does not drop previously confirmed fields', () => {
    const first = applyOperatorCorrectionToSnapshot(snapshot(), 'caseType', 'leave');
    const merged = mergeOperatorConfirmedFields(first.operatorConfirmedFields, 'storeNumber');
    expect(merged).toEqual(['caseType', 'storeNumber']);
  });
});
