import { INTERCOM_CASE_TYPE_SLUGS } from '../../../src/constants/intercom.constants.js';
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_RESPONSE_SCHEMA,
  buildExtractionV2SystemPrompt,
  buildExtractionV2UserPrompt
} from '../../../src/modules/employee/employee.extraction-v2.prompt.js';

describe('extraction-v3 prompt contract', () => {
  it('uses the extraction-v3 version and real category enum', () => {
    expect(EXTRACTION_PROMPT_VERSION).toBe('extraction-v4');
    const prompt = buildExtractionV2SystemPrompt();
    for (const slug of INTERCOM_CASE_TYPE_SLUGS) {
      expect(prompt).toContain(slug);
    }
    expect(EXTRACTION_RESPONSE_SCHEMA.required).toEqual([
      'employee',
      'classification',
      'issueSummary',
      'relatedCaseSearchTerms'
    ]);
  });

  it('requires null employee for typo and screenshot subjects', () => {
    const prompt = buildExtractionV2SystemPrompt();
    expect(prompt).toContain('this si the issue that is faced and test workspace');
    expect(prompt).toContain('first intercom test conversation');
    expect(prompt).toContain('A random word or typo is not a human name');
    expect(prompt).toContain('Braden is talking shit in office and handling work badly');
    expect(prompt).toContain('Jamie Smith');
    expect(prompt).toContain('John Smith');
    expect(prompt).toContain('NO_EMPLOYEE_MENTIONED');
    expect(prompt).toContain('UNTRUSTED DATA');
    expect(prompt).toContain('Never use application statuses or tags as categories');
  });

  it('keeps untrusted fields in delimited user input', () => {
    const user = buildExtractionV2UserPrompt({
      subject: 'first intercom test conversation',
      messageBody: 'first intercom test conversation',
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'reporter@example.com'
    });

    expect(user).toContain('SUBJECT:\nfirst intercom test conversation');
    expect(user).toContain('MESSAGE_BODY:\nfirst intercom test conversation');
    expect(user).toContain('REPORTER_METADATA:');
    expect(user).toContain('Syed Zohaib Haider');
  });
});
