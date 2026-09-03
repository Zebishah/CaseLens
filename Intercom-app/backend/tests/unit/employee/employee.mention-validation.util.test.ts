import {
  validateEmployeeMention
} from '../../../src/modules/employee/employee.mention-validation.util.js';

describe('validateEmployeeMention', () => {
  it('rejects the screenshot subject first intercom test conversation', () => {
    const result = validateEmployeeMention({
      subject: 'first intercom test conversation',
      name: 'First Intercom',
      evidence: 'First Intercom'
    });
    expect(result).toEqual({ valid: false, reason: 'generic_phrase' });
  });

  it.each([
    ['first intercom test conversation', 'First Intercom'],
    ['Intercom webhook test', 'Intercom Webhook'],
    ['HR Intelligence test case', 'HR Intelligence'],
    ['Test Conversation', 'Test Conversation'],
    ['Store 1042 payroll issue', 'Store Payroll'],
    ['Payroll concern', 'Payroll Concern'],
    ['Payroll Issue', 'Payroll Issue'],
    ['Store Manager', 'Store Manager'],
    ['General Case', 'General Case'],
    ['Employee Case', 'Employee Case'],
    ['Support Request', 'Support Request']
  ])('rejects generic or platform phrase from %s', (subject, name) => {
    const result = validateEmployeeMention({ subject, name, evidence: name });
    expect(result.valid).toBe(false);
  });

  it.each([
    ['Attendance issue for Ayesha Khan', 'Ayesha Khan'],
    ['John Smith - repeated absence', 'John Smith'],
    ['Jamie Smith attendance issue', 'Jamie Smith'],
    ['John Smith is talking badly at work', 'John Smith'],
    ["Employee: Sarah O'Connor - payroll", "Sarah O'Connor"],
    ['Leave request concerning Muhammad Ali', 'Muhammad Ali'],
    ['Jean-Luc Picard conduct complaint', 'Jean-Luc Picard']
  ])('accepts explicit human name in %s', (subject, name) => {
    const result = validateEmployeeMention({ subject, name, evidence: name });
    expect(result).toMatchObject({
      valid: true,
      normalizedName: name
    });
  });

  it('rejects a Gemini name that is not a contiguous substring of the subject', () => {
    const result = validateEmployeeMention({
      subject: 'first intercom test conversation',
      name: 'Ayesha Khan',
      evidence: 'Ayesha Khan'
    });
    expect(result).toEqual({ valid: false, reason: 'not_in_subject' });
  });

  it('rejects empty name or evidence', () => {
    expect(
      validateEmployeeMention({ subject: 'Attendance issue for Ayesha Khan', name: null, evidence: null })
    ).toEqual({ valid: false, reason: 'missing' });
  });

  it('rejects emails, URLs and numeric IDs', () => {
    expect(
      validateEmployeeMention({
        subject: 'case 215475745905420',
        name: '215475745905420',
        evidence: '215475745905420'
      })
    ).toEqual({ valid: false, reason: 'invalid_characters' });
    expect(
      validateEmployeeMention({
        subject: 'email zebi@example.com',
        name: 'zebi@example.com',
        evidence: 'zebi@example.com'
      })
    ).toEqual({ valid: false, reason: 'invalid_characters' });
  });

  it('does not treat the reporter as the employee when the name is absent from the subject', () => {
    const result = validateEmployeeMention({
      subject: 'first intercom test conversation',
      name: 'Syed Zohaib Haider',
      evidence: 'Syed Zohaib Haider',
      reporterName: 'Syed Zohaib Haider'
    });
    expect(result.valid).toBe(false);
  });

  it.each([
    'this si the issue that is faced and test workspace',
    'first intercom test conversation',
    'this is a test workspace',
    'the issue is faced by the team',
    'si is having an attendance issue'
  ])('rejects a non-name token from %s as NO_EMPLOYEE_MENTIONED, not unresolved', (subject) => {
    const result = validateEmployeeMention({
      subject,
      name: 'Si',
      evidence: 'Si',
      source: 'gemini'
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a Gemini single-token typo even when it appears in the subject', () => {
    expect(
      validateEmployeeMention({
        subject: 'this si the issue that is faced and test workspace',
        name: 'Si',
        evidence: 'Si',
        source: 'gemini'
      }).valid
    ).toBe(false);
  });

  it('rejects a Gemini candidate shorter than three letters', () => {
    expect(
      validateEmployeeMention({
        subject: 'si is having an attendance issue',
        name: 'Si',
        evidence: 'Si',
        source: 'gemini'
      })
    ).toMatchObject({ valid: false });
  });

  it('rejects a token taken from the middle of an ordinary sentence', () => {
    expect(
      validateEmployeeMention({
        subject: 'this si the issue that is faced and test workspace',
        name: 'Si',
        evidence: 'Si'
      }).valid
    ).toBe(false);
  });

  it('accepts a surname or first name in the middle of a subject sentence', () => {
    expect(
      validateEmployeeMention({
        subject: 'weed smoked by the Watkins and this is issue now',
        name: 'Watkins',
        evidence: 'Watkins',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Watkins' });
    expect(
      validateEmployeeMention({
        subject: 'Attendance issues with Ayesha today',
        name: 'Ayesha',
        evidence: 'Ayesha',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Ayesha' });
  });

  it('accepts a one-word person name at the start of a real HR subject', () => {
    expect(
      validateEmployeeMention({
        subject: 'Braden is talking shit in office and handling work badly',
        name: 'Braden',
        evidence: 'Braden',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Braden' });
    expect(
      validateEmployeeMention({
        subject: 'messi behavior issue',
        name: 'Messi',
        evidence: 'Messi',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Messi' });
  });

  it('accepts a one-word name with an explicit employee construction', () => {
    expect(
      validateEmployeeMention({
        subject: 'Attendance issue for Cher',
        name: 'Cher',
        evidence: 'Cher',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Cher' });
    expect(
      validateEmployeeMention({
        subject: 'Employee: Cher',
        name: 'Cher',
        evidence: 'Cher',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Cher' });
    expect(
      validateEmployeeMention({
        subject: 'Case regarding Cher',
        name: 'Cher',
        evidence: 'Cher',
        source: 'gemini'
      })
    ).toMatchObject({ valid: true, normalizedName: 'Cher' });
  });

  it('does not accept reporter metadata as the employee when the subject has no name', () => {
    expect(
      validateEmployeeMention({
        subject: 'this si the issue that is faced and test workspace',
        name: 'Syed Zohaib Haider',
        evidence: 'Syed Zohaib Haider',
        reporterName: 'Syed Zohaib Haider'
      }).valid
    ).toBe(false);
  });

  it('rejects action phrases but accepts Sarah after the by cue', () => {
    const subject = 'many work is done wrong by sarah company should take notice';

    expect(
      validateEmployeeMention({ subject, name: 'Done Wrong', evidence: 'Done Wrong' })
    ).toEqual({ valid: false, reason: 'generic_phrase' });
    expect(
      validateEmployeeMention({ subject, name: 'Work Done', evidence: 'Work Done' })
    ).toMatchObject({ valid: false });
    expect(
      validateEmployeeMention({ subject, name: 'Sarah', evidence: 'Sarah' })
    ).toMatchObject({ valid: true, normalizedName: 'Sarah' });
  });

});
