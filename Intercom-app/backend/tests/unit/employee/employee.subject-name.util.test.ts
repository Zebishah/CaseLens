import {
  extractEmployeeNamesFromSubject,
  filterEmployeeNamesToSubject,
  resolveSubjectEmployeeNames,
  sanitizeExtractedEmployeeName,
  sanitizeExtractedEmployeeNames
} from '../../../src/modules/employee/employee.subject-name.util.js';

describe('employee.subject-name.util', () => {
  describe('sanitizeExtractedEmployeeName', () => {
    it('strips case-type tail words from Gemini-style names', () => {
      expect(sanitizeExtractedEmployeeName('Messi Behavior Issue')).toBe('Messi');
      expect(sanitizeExtractedEmployeeName('Missi Behavior')).toBe('Missi');
      expect(sanitizeExtractedEmployeeName('Katy Jones attendance issue')).toBe('Katy Jones');
    });

    it('keeps valid two-word names', () => {
      expect(sanitizeExtractedEmployeeName('Jonathan Fritz')).toBe('Jonathan Fritz');
      expect(sanitizeExtractedEmployeeName('Katy Jones')).toBe('Katy Jones');
    });

    it('truncates names longer than two words', () => {
      expect(sanitizeExtractedEmployeeName('Syed Zohaib Haider')).toBe('Syed Zohaib');
      expect(sanitizeExtractedEmployeeName('Mike John Behavioral')).toBe('Mike John');
    });

    it('does not treat "has" as part of a name', () => {
      expect(sanitizeExtractedEmployeeName('Mike has office attendance issue')).toBe('Mike');
      expect(extractEmployeeNamesFromSubject('Mike has office attendance issue')).toEqual(['Mike']);
    });

    it('does not treat action verbs like teasing as a last name', () => {
      expect(sanitizeExtractedEmployeeName('Taylor Teasing')).toBe('Taylor');
      expect(sanitizeExtractedEmployeeNames(['Taylor', 'Taylor Teasing'])).toEqual(['Taylor']);
      expect(extractEmployeeNamesFromSubject('Taylor teasing other employees')).toEqual([
        'Taylor'
      ]);
    });

    it('does not treat "using drugs" fragments as employee names', () => {
      expect(sanitizeExtractedEmployeeName('Using')).toBe('');
      expect(sanitizeExtractedEmployeeName('Ahsan Using')).toBe('Ahsan');
      expect(
        sanitizeExtractedEmployeeNames(['Ahsan', 'Using', 'Ahsan Using'])
      ).toEqual(['Ahsan']);
      expect(extractEmployeeNamesFromSubject('ahsan - using drugs')).toEqual(['Ahsan']);
      expect(extractEmployeeNamesFromSubject('ahsan was using drugs')).toEqual(['Ahsan']);
    });

    it('does not treat pronouns like he/she as employee names', () => {
      expect(sanitizeExtractedEmployeeName('He')).toBe('');
      expect(sanitizeExtractedEmployeeName('She')).toBe('');
      expect(sanitizeExtractedEmployeeNames(['He', 'Rayan Burk'])).toEqual(['Rayan Burk']);
      expect(
        extractEmployeeNamesFromSubject('he was so smoking these days - Rayan burk')
      ).toEqual(['Rayan Burk']);
      expect(extractEmployeeNamesFromSubject('she was late again - Sara Patel')).toEqual([
        'Sara Patel'
      ]);
    });

    it('keeps the person name and drops action phrases like doing lot of smoking', () => {
      expect(sanitizeExtractedEmployeeName('Doing Lot')).toBe('');
      expect(sanitizeExtractedEmployeeName('Izaac Is')).toBe('Izaac');
      expect(sanitizeExtractedEmployeeNames(['Doing Lot', 'Isaac'])).toEqual(['Isaac']);
      expect(extractEmployeeNamesFromSubject('isaac - doing lot of smoking')).toEqual(['Isaac']);
      expect(extractEmployeeNamesFromSubject('izaac is doing lot of smoking')).toEqual(['Izaac']);
      expect(extractEmployeeNamesFromSubject('asaad sha was drinking lot of beer')).toEqual([
        'Asaad Sha'
      ]);
    });
  });

  describe('extractEmployeeNamesFromSubject', () => {
    it('extracts the name after a dash in the subject', () => {
      expect(extractEmployeeNamesFromSubject('Poor attendance - zubair')).toEqual(['Zubair']);
      expect(extractEmployeeNamesFromSubject('bad attendance record - zebi')).toEqual(['Zebi']);
      expect(extractEmployeeNamesFromSubject('Attendance issue - zubi shah')).toEqual(['Zubi Shah']);
    });

    it('keeps the person before a dash and rejects issue phrases like illegal activities', () => {
      expect(sanitizeExtractedEmployeeName('Illegal Activities')).toBe('');
      expect(sanitizeExtractedEmployeeNames(['Illegal Activities', 'Marc Jones'])).toEqual([
        'Marc Jones'
      ]);
      expect(extractEmployeeNamesFromSubject('Marc Jones - illegal activities')).toEqual([
        'Marc Jones'
      ]);
      expect(extractEmployeeNamesFromSubject('illegal activities - Marc Jones')).toEqual([
        'Marc Jones'
      ]);
    });

    it('finds the human name across dash, comma, and for/regarding shapes', () => {
      expect(extractEmployeeNamesFromSubject('Marc Jones, illegal activities')).toEqual([
        'Marc Jones'
      ]);
      expect(extractEmployeeNamesFromSubject('Attendance concern for Sara Patel')).toEqual([
        'Sara Patel'
      ]);
      expect(extractEmployeeNamesFromSubject('Warning regarding Ryan Burke')).toEqual([
        'Ryan Burke'
      ]);
      expect(extractEmployeeNamesFromSubject('misconduct report - Chris Adams')).toEqual([
        'Chris Adams'
      ]);
    });

    it('takes only the first real person from a comma-and list, not the topic glued to the last name', () => {
      const subject =
        'Tammy, Maureen, and Pam Request for Guidance on Team Communication and Conflict Resolution 7/29/26';

      expect(sanitizeExtractedEmployeeName('Pam Request')).toBe('Pam');
      expect(extractEmployeeNamesFromSubject(subject)).toEqual(['Tammy']);
      expect(resolveSubjectEmployeeNames(subject, ['Pam Request'])).toEqual(['Tammy']);
      expect(resolveSubjectEmployeeNames(subject, ['Tammy', 'Maureen', 'Pam'])).toEqual(['Tammy']);
      expect(extractEmployeeNamesFromSubject('John Smith - attendance')).toEqual(['John Smith']);
      expect(extractEmployeeNamesFromSubject('Jamie Smith attendance issue')).toEqual([
        'Jamie Smith'
      ]);
      expect(
        extractEmployeeNamesFromSubject('John Smith is talking badly at work')
      ).toEqual(['John Smith']);
    });

    it('extracts a leading name before case-type words without a dash', () => {
      expect(extractEmployeeNamesFromSubject('messi behavior issue')).toEqual(['Messi']);
      expect(extractEmployeeNamesFromSubject('missi behavior issue')).toEqual(['Missi']);
      expect(extractEmployeeNamesFromSubject('Cooper Salt attendance warning')).toEqual(['Cooper Salt']);
    });

    it('extracts a first name or surname from the middle of a subject sentence', () => {
      expect(
        extractEmployeeNamesFromSubject('weed smoked by the Watkins and this is issue now')
      ).toEqual(['Watkins']);
      expect(extractEmployeeNamesFromSubject('Attendance issues with Ayesha today')).toEqual([
        'Ayesha'
      ]);
      expect(
        resolveSubjectEmployeeNames('weed smoked by the Watkins and this is issue now', [])
      ).toEqual(['Watkins']);
    });

    it('returns an empty list when the subject has no person name', () => {
      expect(extractEmployeeNamesFromSubject('Attendance concern')).toEqual([]);
      expect(extractEmployeeNamesFromSubject(null)).toEqual([]);
      expect(extractEmployeeNamesFromSubject('first intercom test conversation')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('this si the issue that is faced and test workspace')).toEqual(
        []
      );
      expect(extractEmployeeNamesFromSubject('this is a test workspace')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('the issue is faced by the team')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('si is having an attendance issue')).toEqual([]);
      expect(
        extractEmployeeNamesFromSubject(
          'Braden is talking shit in office and handling work badly'
        )
      ).toEqual(['Braden']);
      expect(extractEmployeeNamesFromSubject('Intercom webhook test')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('HR Intelligence test')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('Store 1042 payroll issue')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('Payroll concern')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('Test Conversation')).toEqual([]);
      expect(extractEmployeeNamesFromSubject('HR case test')).toEqual([]);
    });

    it('extracts explicit human names from HR subjects', () => {
      expect(extractEmployeeNamesFromSubject('Attendance issue for Ayesha Khan')).toEqual([
        'Ayesha Khan'
      ]);
      expect(extractEmployeeNamesFromSubject('John Smith - repeated absence')).toEqual([
        'John Smith'
      ]);
      expect(extractEmployeeNamesFromSubject("Employee: Sarah O'Connor - payroll")).toEqual([
        "Sarah O'Connor"
      ]);
      expect(extractEmployeeNamesFromSubject('Leave request concerning Muhammad Ali')).toEqual([
        'Muhammad Ali'
      ]);
      expect(extractEmployeeNamesFromSubject('Jean-Luc Picard conduct complaint')).toEqual([
        'Jean-Luc Picard'
      ]);
    });

    it('does not treat the reporter as the employee when the subject only names the reporter', () => {
      expect(
        extractEmployeeNamesFromSubject('Issue reported by Syed Zohaib Haider')
      ).toEqual([]);
    });

    it('returns no employee when two people are named without a clear subject', () => {
      expect(
        extractEmployeeNamesFromSubject('Discussion between Ayesha Khan and Sarah Ahmed')
      ).toEqual([]);
    });

    it('rejects Gemini inventing First Intercom from a test subject', () => {
      expect(
        resolveSubjectEmployeeNames('first intercom test conversation', ['First Intercom'])
      ).toEqual([]);
    });

    it('keeps Cydney and drops Person UI from a due-date subject', () => {
      expect(sanitizeExtractedEmployeeName('Cydney Person')).toBe('Cydney');
      expect(sanitizeExtractedEmployeeName('Cydney Person UI')).toBe('Cydney');
      expect(
        extractEmployeeNamesFromSubject('Due 8/17/26 Cydney Person UI')
      ).toEqual(['Cydney']);
      expect(resolveSubjectEmployeeNames('Due 8/17/26 Cydney Person UI', ['Cydney Person'])).toEqual(
        ['Cydney']
      );
    });

    it('does not treat Follow-up ticket labels as an employee name', () => {
      expect(sanitizeExtractedEmployeeName('Follow-up')).toBe('');
      expect(sanitizeExtractedEmployeeName('Follow up')).toBe('');
      expect(
        extractEmployeeNamesFromSubject(
          'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:12:58 PM'
        )
      ).toEqual([]);
    });

    it('does not treat social notification subjects as employee names', () => {
      expect(sanitizeExtractedEmployeeName('Recently Added')).toBe('');
      expect(sanitizeExtractedEmployeeName('Newly Posted')).toBe('');
      expect(
        extractEmployeeNamesFromSubject(
          'srecord1 and 7 others recently added to their stories'
        )
      ).toEqual([]);
      expect(
        extractEmployeeNamesFromSubject(
          '_honorablewoman and 7 others recently added to their stories'
        )
      ).toEqual([]);
      expect(
        resolveSubjectEmployeeNames(
          'srecord1 and 7 others recently added to their stories',
          ['Recently Added']
        )
      ).toEqual([]);
      expect(
        filterEmployeeNamesToSubject(
          ['Recently Added'],
          'srecord1 and 7 others recently added to their stories'
        )
      ).toEqual([]);
    });

    it('still keeps real first and last names', () => {
      expect(extractEmployeeNamesFromSubject('Mary Fortunata - attendance')).toEqual([
        'Mary Fortunata'
      ]);
      expect(sanitizeExtractedEmployeeName('Mary Fortunata')).toBe('Mary Fortunata');
      expect(extractEmployeeNamesFromSubject('Emily Jones - attendance')).toEqual(['Emily Jones']);
      expect(extractEmployeeNamesFromSubject('Ahmed Khan - attendance')).toEqual(['Ahmed Khan']);
    });

    it('ignores HR issue phrases and keeps the person name from mixed dash subjects', () => {
      expect(extractEmployeeNamesFromSubject('Harvey Spectre - legal notice')).toEqual([
        'Harvey Spectre'
      ]);
      expect(extractEmployeeNamesFromSubject('Mark Wells - legal issue')).toEqual(['Mark Wells']);
      expect(extractEmployeeNamesFromSubject('Jeremy Clark - harrasment warning')).toEqual([
        'Jeremy Clark'
      ]);
      expect(extractEmployeeNamesFromSubject('Jeremy - harrasment concerns')).toEqual(['Jeremy']);
      expect(extractEmployeeNamesFromSubject('legal notice - Mark Wells')).toEqual(['Mark Wells']);
    });

    it('rejects issue phrases Gemini sometimes returns as names', () => {
      expect(sanitizeExtractedEmployeeName('Legal Notice')).toBe('');
      expect(sanitizeExtractedEmployeeName('Legal')).toBe('');
      expect(sanitizeExtractedEmployeeName('Harrasment')).toBe('');
      expect(sanitizeExtractedEmployeeName('Harassment')).toBe('');
      expect(
        sanitizeExtractedEmployeeNames(['Harvey Spectre', 'Legal Notice', 'Harrasment'])
      ).toEqual(['Harvey Spectre']);
    });
  });

  describe('resolveSubjectEmployeeNames', () => {
    it('drops Gemini topic phrases and keeps the real subject person', () => {
      expect(
        resolveSubjectEmployeeNames('Marc Jones - illegal activities', ['Illegal Activities'])
      ).toEqual(['Marc Jones']);
    });

    it('keeps Gemini person names when they already look valid', () => {
      expect(
        resolveSubjectEmployeeNames('Marc Jones - illegal activities', ['Marc Jones'])
      ).toEqual(['Marc Jones']);
    });

    it('prefers a Gemini person over a conflicting topic-like manual miss', () => {
      expect(
        resolveSubjectEmployeeNames('Attendance concern for Sara Patel', ['Sara Patel'])
      ).toEqual(['Sara Patel']);
    });

    it('drops Gemini names that are not in the subject', () => {
      expect(
        resolveSubjectEmployeeNames(
          'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:12:58 PM',
          ['Rayan Burk']
        )
      ).toEqual([]);
      expect(
        resolveSubjectEmployeeNames('Due 8/17/26 Cydney Person UI', ['Cydney Person', 'Rayan Burk'])
      ).toEqual(['Cydney']);
    });
  });

  describe('filterEmployeeNamesToSubject', () => {
    it('does not keep a name that would create the wrong employee', () => {
      expect(
        filterEmployeeNamesToSubject(
          ['Rayan Burk'],
          'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:08:48 PM'
        )
      ).toEqual([]);
    });

    it('keeps a real subject name so later re-analyze can match it', () => {
      expect(filterEmployeeNamesToSubject(['Marc Jones'], 'Marc Jones - illegal activities')).toEqual([
        'Marc Jones'
      ]);
    });
  });

  describe('sanitizeExtractedEmployeeNames', () => {
    it('deduplicates sanitized names', () => {
      expect(
        sanitizeExtractedEmployeeNames(['Messi Behavior Issue', 'messi', 'Messi'])
      ).toEqual(['Messi']);
    });
  });
});
