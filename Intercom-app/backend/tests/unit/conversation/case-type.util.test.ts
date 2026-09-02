import { INTERCOM_CASE_TYPES } from '../../../src/constants/intercom.constants.js';
import {
  caseTypesMatchForRelated,
  expandCaseTypeSearchSlugs,
  formatCaseTypeLabel,
  inferCaseType,
  inferCaseTypeFromSubject,
  mergeCaseTypeSignals,
  normalizeCaseTypeForRelatedBucket,
  normalizeCaseTypeSlug,
  normalizeSubjectForCaseTypeMatch,
  resolveCaseType,
  subjectsShareCaseTypeBucket
} from '../../../src/modules/conversation/case-type.util.js';

describe('inferCaseType', () => {
  it('locks unknown Gemini slugs and application status tags to the real enum', () => {
    expect(
      resolveCaseType({
        subject: 'this si the issue that is faced and test workspace',
        rawPayload: {
          tags: {
            tags: [{ name: 'hr-intelligence-processed' }, { name: 'category-hr-intelligence-processed' }]
          }
        },
        geminiCaseType: 'general'
      })
    ).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(normalizeCaseTypeSlug('hr-intelligence-processed')).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(normalizeCaseTypeSlug('HR Intelligence Processed')).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(normalizeCaseTypeSlug('manual-review')).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(normalizeCaseTypeSlug('processing')).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(normalizeCaseTypeSlug('dress_code')).toBe(INTERCOM_CASE_TYPES.GENERAL);
    expect(formatCaseTypeLabel('general')).toBe('General');
  });

  it('uses Gemini category first when provided', () => {
    expect(
      resolveCaseType({
        subject: 'Mark sloan',
        rawPayload: { tags: [{ name: 'misconduct' }] },
        geminiCaseType: 'attendance'
      })
    ).toBe(INTERCOM_CASE_TYPES.ATTENDANCE);
  });

  it('falls back to subject keywords when Gemini is absent or general', () => {
    expect(
      resolveCaseType({
        subject: 'late again today',
        rawPayload: null,
        geminiCaseType: 'general'
      })
    ).toBe(INTERCOM_CASE_TYPES.ATTENDANCE);
  });

  it('does not derive a category from Intercom tags', () => {
    expect(
      resolveCaseType({
        subject: 'Mark sloan',
        rawPayload: { tags: [{ name: 'misconduct' }, { name: 'hr-intelligence-processed' }] },
        geminiCaseType: null
      })
    ).toBe(INTERCOM_CASE_TYPES.GENERAL);
  });

  it('uses similar-subject reuse after Gemini/keywords/tags miss', () => {
    expect(
      resolveCaseType({
        subject: 'Need help with this employee again',
        rawPayload: null,
        geminiCaseType: 'general',
        similarSubjectCaseType: 'coaching'
      })
    ).toBe(INTERCOM_CASE_TYPES.COACHING);
  });

  it('infers case type from subject keywords when tags and AI are absent', () => {
    expect(inferCaseType('Attendance warning — late arrivals', null)).toBe(
      INTERCOM_CASE_TYPES.ATTENDANCE
    );
  });

  it('classifies harassment and drug-use subjects as misconduct', () => {
    expect(inferCaseTypeFromSubject('he harasses that girl')).toBe(
      INTERCOM_CASE_TYPES.MISCONDUCT
    );
    expect(inferCaseTypeFromSubject('he was smoking weed at work')).toBe(
      INTERCOM_CASE_TYPES.MISCONDUCT
    );
  });

  it('infers the new operational categories from subject keywords', () => {
    expect(inferCaseTypeFromSubject('Alex Kim shift swap request')).toBe(
      INTERCOM_CASE_TYPES.SCHEDULE
    );
    expect(inferCaseTypeFromSubject('Workplace injury - Sam Reed')).toBe(
      INTERCOM_CASE_TYPES.INJURY
    );
    expect(inferCaseTypeFromSubject('ADA accommodation request')).toBe(
      INTERCOM_CASE_TYPES.ACCOMMODATION
    );
    expect(inferCaseTypeFromSubject('Store transfer - Jordan Lee')).toBe(
      INTERCOM_CASE_TYPES.TRANSFER
    );
    expect(inferCaseTypeFromSubject('Handbook policy question')).toBe(INTERCOM_CASE_TYPES.POLICY);
  });

  it('defaults to general when no signals match', () => {
    expect(inferCaseType('General HR question', null)).toBe(INTERCOM_CASE_TYPES.GENERAL);
  });

  it('classifies ethics/conduct subjects as conduct when no AI signal exists', () => {
    expect(
      inferCaseType('Concern Regarding Employee Conduct and Compliance with Company Ethics', null)
    ).toBe(INTERCOM_CASE_TYPES.CONDUCT);
  });

  it('prefers attendance over conduct when subject contains both signals', () => {
    expect(inferCaseTypeFromSubject('late again — employee conduct discussion')).toBe(
      INTERCOM_CASE_TYPES.ATTENDANCE
    );
  });

  it('uses stored classification when nothing else resolves', () => {
    expect(
      resolveCaseType({
        subject: 'Follow up',
        rawPayload: null,
        storedCaseType: 'attendance'
      })
    ).toBe(INTERCOM_CASE_TYPES.ATTENDANCE);
  });

  it('mergeCaseTypeSignals prefers AI when present', () => {
    expect(mergeCaseTypeSignals('late again', 'coaching')).toBe(INTERCOM_CASE_TYPES.COACHING);
  });

  it('mergeCaseTypeSignals falls back to subject keywords when AI is absent', () => {
    expect(mergeCaseTypeSignals('late again', null)).toBe(INTERCOM_CASE_TYPES.ATTENDANCE);
  });
});

describe('similar subject matching for case type reuse', () => {
  it('normalizes near-identical lateness subjects to the same bucket', () => {
    expect(normalizeSubjectForCaseTypeMatch('Late again')).toBe(
      normalizeSubjectForCaseTypeMatch('late again today')
    );
  });

  it('treats near-identical subjects as the same case-type bucket', () => {
    expect(subjectsShareCaseTypeBucket('late again', 'Late again today')).toBe(true);
  });

  it('does not treat unrelated subjects as the same bucket', () => {
    expect(subjectsShareCaseTypeBucket('late again', 'payroll issue this week')).toBe(false);
  });
});

describe('conduct / misconduct family', () => {
  it('treats conduct and misconduct as the same related-case bucket', () => {
    expect(normalizeCaseTypeForRelatedBucket('misconduct')).toBe(INTERCOM_CASE_TYPES.CONDUCT);
    expect(normalizeCaseTypeForRelatedBucket('conduct')).toBe(INTERCOM_CASE_TYPES.CONDUCT);
    expect(caseTypesMatchForRelated('conduct', 'misconduct')).toBe(true);
    expect(caseTypesMatchForRelated('misconduct', 'attendance')).toBe(false);
  });

  it('expands search to both conduct and misconduct slugs', () => {
    expect(expandCaseTypeSearchSlugs('misconduct')).toEqual([
      INTERCOM_CASE_TYPES.CONDUCT,
      INTERCOM_CASE_TYPES.MISCONDUCT
    ]);
    expect(expandCaseTypeSearchSlugs('attendance')).toEqual([INTERCOM_CASE_TYPES.ATTENDANCE]);
  });

  it('shows both as Conduct in the UI label', () => {
    expect(formatCaseTypeLabel('misconduct')).toBe('Conduct');
    expect(formatCaseTypeLabel('conduct')).toBe('Conduct');
    expect(formatCaseTypeLabel('attendance')).toBe('Attendance');
  });
});
