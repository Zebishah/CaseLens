import { parseReporterContext, resolveReporterContext } from '../../../src/modules/employee/employee.reporter-context.util.js';

describe('employee.reporter-context.util', () => {
  it('extracts store number and domain from reporter email', () => {
    expect(parseReporterContext('Amber R', '3456@acmecorp.com')).toEqual({
      storeNumber: '3456',
      domain: 'acmecorp.com'
    });
  });

  it('extracts store number and domain embedded in reporter name', () => {
    expect(parseReporterContext('3456@acmecorp.com', null)).toEqual({
      storeNumber: '3456',
      domain: 'acmecorp.com'
    });
  });

  it('returns domain only when email local part is not numeric', () => {
    expect(parseReporterContext('HR Contact', 'hr@acmecorp.com')).toEqual({
      storeNumber: null,
      domain: 'acmecorp.com'
    });
  });

  it('extracts digits-only store from mixed inbox local parts', () => {
    expect(parseReporterContext(null, '4280jjstore@meridian.co')).toEqual({
      storeNumber: '4280',
      domain: 'meridian.co'
    });

    expect(parseReporterContext(null, 'jjkr453895@northwind.co')).toEqual({
      storeNumber: '453895',
      domain: 'northwind.co'
    });

    expect(parseReporterContext(null, '895@northwind.co')).toEqual({
      storeNumber: '895',
      domain: 'northwind.co'
    });
  });

  it('extracts trailing digits from letter-prefixed inbox locals (legacy alphanumeric test stores)', () => {
    expect(parseReporterContext('Store Contact', 'dd1976@demoops.co')).toEqual({
      storeNumber: '1976',
      domain: 'demoops.co'
    });

    expect(parseReporterContext(null, '10206@demoops.co')).toEqual({
      storeNumber: '10206',
      domain: 'demoops.co'
    });
  });

  it('does not treat trailing digits in email local part as store number', () => {
    expect(parseReporterContext('Syed Zohaib Haider', 'zebihaider123@gmail.com')).toEqual({
      storeNumber: null,
      domain: 'gmail.com'
    });

    expect(parseReporterContext(null, 'zebihaider123@demoops.co')).toEqual({
      storeNumber: null,
      domain: 'demoops.co'
    });
  });

  it('returns nulls when reporter signals are missing', () => {
    expect(parseReporterContext(null, null)).toEqual({
      storeNumber: null,
      domain: null
    });
  });

  it('extracts glued numeric store codes from reporter display names like 10206demoops', () => {
    expect(parseReporterContext('10206demoops', 'manager@demoops.co')).toEqual({
      storeNumber: '10206',
      domain: 'demoops.co'
    });
  });

  it('extracts digits from glued letter-prefixed display names like dd1976demoops', () => {
    expect(parseReporterContext('dd1976demoops', 'manager@demoops.co')).toEqual({
      storeNumber: '1976',
      domain: 'demoops.co'
    });
  });

  it('prefers reporter email store when both glued name and store email are present', () => {
    expect(parseReporterContext('10206demoops', 'dd1976@demoops.co')).toEqual({
      storeNumber: '1976',
      domain: 'demoops.co'
    });
  });

  it('does not treat personal reporter names with digits as glued store codes', () => {
    expect(parseReporterContext('2356dZubairzahid', 'zubair-zahid@demoops.co')).toEqual({
      storeNumber: null,
      domain: 'demoops.co'
    });
  });

  it('accepts short numeric store ids from reporter email (1–2 digits and 5+ digits)', () => {
    expect(parseReporterContext('JJ 78', '78@northwind.co')).toEqual({
      storeNumber: '78',
      domain: 'northwind.co'
    });

    expect(parseReporterContext('Store 1', '1@northwind.co')).toEqual({
      storeNumber: '1',
      domain: 'northwind.co'
    });

    expect(parseReporterContext(null, '123456@acmecorp.com')).toEqual({
      storeNumber: '123456',
      domain: 'acmecorp.com'
    });
  });

  it('uses a contact inbox email when source author email has no store number', () => {
    expect(
      resolveReporterContext('JJ 78', 'mailer@northwind.co', ['78@northwind.co'])
    ).toEqual({
      storeNumber: '78',
      domain: 'northwind.co'
    });
  });
});
