import { jest } from '@jest/globals';

const originalFetch = global.fetch;

describe('employeeNameExtractionService', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('parses employee names from Gemini JSON response', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"names":["Luis Castillo","Nadalie Hamilton"],"caseType":"vacation"}'
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      messageBodies: ['<p>Luis Castillo and Nadalie Hamilton vacation</p>'],
      reporterName: 'Ellis ( Fort Carson, CO ) CHC',
      reporterEmail: 'ellis@example.com'
    });

    expect(result.source).toBe('gemini');
    expect(result.names).toEqual(['Luis Castillo', 'Nadalie Hamilton']);
    expect(result.caseType).toBe('vacation');
  });

  it('excludes reporter name from extracted results', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Ellis ( Fort Carson, CO ) CHC","Luis Castillo"]}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      messageBodies: ['Luis Castillo vacation'],
      reporterName: 'Ellis ( Fort Carson, CO ) CHC',
      reporterEmail: 'ellis@example.com'
    });

    expect(result.names).toEqual(['Luis Castillo']);
  });

  it('does not retry Gemini when quota is exhausted', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        '{"error":{"code":429,"message":"Your prepayment credits are depleted"}}'
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    await expect(
      employeeNameExtractionService.extract({
        messageBodies: ['Concerns about Hassan Memon and delays in assigned work.'],
        reporterName: 'Zohaib shah',
        reporterEmail: 'zohaib@example.com'
      })
    ).rejects.toThrow('Gemini API error 429');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses subject employee only and ignores outdated body names when subject names someone', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Zunair"],"caseType":"attendance"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'Poor attendance - zunair',
      messageBodies: [
        '<p>Dear HR Team, concerns regarding the attendance of zerbi shah.</p>'
      ],
      reporterName: 'Zubair Zahid',
      reporterEmail: 'zubair-zahid@demoops.co'
    });

    expect(result.names).toEqual(['Zunair']);
    expect(result.caseType).toBe('attendance');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const requestBody = JSON.parse(
      String((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body)
    );
    const prompt = requestBody.contents[0].parts[0].text as string;
    expect(prompt).toContain('Poor attendance - zunair');
    expect(prompt).toContain('Position does NOT matter');
    expect(prompt).toContain('Find the HUMAN NAME in the subject, no matter where it sits');
    expect(requestBody.generationConfig.responseSchema).toBeUndefined();
  });

  it('reads case category from conversation messages when subject has no topic', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"names":["Mark Sloan"],"caseType":"general"}' }]
              }
            }
          ]
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"caseType":"attendance"}' }]
              }
            }
          ]
        })
      } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'Mark sloan',
      messageBodies: ['<p>Mark sloan late again today</p>'],
      reporterName: 'dd1976demoops',
      reporterEmail: 'dd1976@demoops.co'
    });

    expect(result.names).toEqual(['Mark Sloan']);
    expect(result.caseType).toBe('attendance');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const messagePrompt = JSON.parse(
      String((global.fetch as jest.Mock).mock.calls[1]?.[1]?.body)
    ).contents[0].parts[0].text as string;
    expect(messagePrompt).toContain('Mark sloan late again today');
    expect(messagePrompt).not.toContain('Subject:');
  });

  it('keeps subject employee when reporter shares the same first name', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Zubair"],"caseType":"attendance"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'attendance issue - zubair',
      messageBodies: [
        '<p>Dear HR Team, concerns regarding the attendance of zubair.</p>'
      ],
      reporterName: 'Zubair Zahid',
      reporterEmail: 'zubair-zahid@demoops.co'
    });

    expect(result.names).toEqual(['Zubair']);
    expect(result.caseType).toBe('attendance');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps full reporter name when it is declared in the subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Zubair Zahid"],"caseType":"attendance"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'attendance issue - Zubair Zahid',
      messageBodies: [
        '<p>Dear HR Team, concerns regarding the attendance of Zubair Zahid.</p>'
      ],
      reporterName: 'Zubair Zahid',
      reporterEmail: 'zubair-zahid@demoops.co'
    });

    expect(result.names).toEqual(['Zubair Zahid']);
    expect(result.caseType).toBe('attendance');
  });

  it('sanitizes Gemini names that include case-type tail words in the subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Messi Behavior Issue"],"caseType":"conduct"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'messi behavior issue',
      messageBodies: ['<p>messi behavior issue is serious</p>'],
      reporterName: 'Zubair Zahid',
      reporterEmail: 'zubair-zahid@demoops.co'
    });

    expect(result.names).toEqual(['Messi']);
    expect(result.caseType).toBe('conduct');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('recovers Marc Jones when Gemini returns Illegal Activities from the subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Illegal Activities"],"caseType":"conduct"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'Marc Jones - illegal activities',
      messageBodies: [
        '<p>Marc Jones - illegal activities, he is involved in selling drugs.</p>'
      ],
      reporterName: 'Mohammad Nehaal',
      reporterEmail: 'nehaal@demoops.co'
    });

    expect(result.names).toEqual(['Marc Jones']);
    expect(result.caseType).toBe('conduct');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns no employee when the subject has no person even if the body names someone', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Rayan Burk"],"caseType":"attendance"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject:
        'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:08:48 PM',
      messageBodies: ['<p>Please review Rayan Burk attendance.</p>'],
      reporterName: 'HR Inbox',
      reporterEmail: 'hr@example.com'
    });

    expect(result.names).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns no employee when the subject has no person and there is no message text', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":[],"caseType":"general"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject:
        'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:08:48 PM',
      messageBodies: [],
      reporterName: 'HR Inbox',
      reporterEmail: 'hr@example.com'
    });

    expect(result.names).toEqual([]);
    expect(result.source).toBe('gemini');
  });

  it('returns no employee when the subject has no person and Gemini is unavailable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('Gemini unavailable'));

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject:
        'Follow-up - Planner for Management Progress Meeting (in-person and virtual options) 08/15/2026 12:08:48 PM',
      messageBodies: [],
      reporterName: 'HR Inbox',
      reporterEmail: 'hr@example.com'
    });

    expect(result.names).toEqual([]);
  });

  it('throws when Gemini fails so intelligence can retry', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('Gemini unavailable'));

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    await expect(
      employeeNameExtractionService.extract({
        messageBodies: [
          'I am writing about repeated delays involving Hassan Memon and Ahsan Pervaiz in assigned work.'
        ],
        reporterName: 'Zohaib shah',
        reporterEmail: 'zohaib@example.com'
      })
    ).rejects.toThrow('Gemini unavailable');
  });

  it('skips Gemini in fixture mode and returns deterministic subject extraction', async () => {
    global.fetch = jest.fn<typeof fetch>();

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      processingMode: 'fixture',
      subject: 'Attendance — Jordan Hale',
      messageBodies: ['Jordan Hale was late three times this week at store 1042.'],
      reporterName: 'Store 1042 Manager',
      reporterEmail: '1042@northwind.co'
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback');
    expect(result.names).toEqual(['Jordan Hale']);
    expect(result.caseType).toBe('attendance');
  });

  it('uses the subject surname when Gemini returns no names', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":[],"caseType":"misconduct"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'weed smoked by the Watkins and this is issue now',
      messageBodies: ['<p>weed smoked by the Watkins and this is issue now</p>'],
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com'
    });

    expect(result.names).toEqual(['Watkins']);
    expect(result.caseType).toBe('misconduct');
  });

  it('keeps a mid-sentence surname Gemini returns from the subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"names":["Watkins"],"caseType":"misconduct"}' }]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'weed smoked by the Watkins and this is issue now',
      messageBodies: ['<p>weed smoked by the Watkins and this is issue now</p>'],
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com'
    });

    expect(result.names).toEqual(['Watkins']);
    expect(result.caseType).toBe('misconduct');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const prompt = JSON.parse(
      String((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body)
    ).contents[0].parts[0].text as string;
    expect(prompt).toContain('weed smoked by the Watkins and this is issue now');
    expect(prompt).toContain('Position does NOT matter');
  });

  it('keeps Gemini Braden from a real one-word employee subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    employee: {
                      name: 'Braden',
                      evidence: 'Braden',
                      status: 'EXPLICIT_NAME_FOUND',
                      confidence: 92
                    },
                    classification: { category: 'conduct', confidence: 88 },
                    issueSummary: 'The report concerns Braden speaking unprofessionally at work.',
                    relatedCaseSearchTerms: ['conduct']
                  })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'Braden is talking shit in office and handling work badly',
      messageBodies: ['Braden is talking shit in office and handling work badly'],
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com'
    });

    expect(result.names).toEqual(['Braden']);
    expect(result.employeeStatus).toBe('EXPLICIT_NAME_FOUND');
    expect(result.caseType).toBe('conduct');
  });

  it('rejects Gemini Si on the typo subject as NO_EMPLOYEE_MENTIONED', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    employee: {
                      name: 'Si',
                      evidence: 'Si',
                      status: 'EXPLICIT_NAME_FOUND',
                      confidence: 88
                    },
                    classification: { category: 'general', confidence: 40 },
                    issueSummary: 'The message is a test sentence without a specific HR issue.',
                    relatedCaseSearchTerms: []
                  })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'this si the issue that is faced and test workspace',
      messageBodies: [
        'this si the issue that is faced and test workspace',
        '<p><strong>HR Intelligence</strong><br/>HR Intelligence · sync:abcdef123456</p><p>Employee mentioned: Si</p>'
      ],
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com'
    });

    expect(result.names).toEqual([]);
    expect(result.employeeStatus).toBe('NO_EMPLOYEE_MENTIONED');
    expect(result.employeeConfidence).toBe(0);
    expect(result.caseType).toBe('general');
    const prompt = String((global.fetch as jest.Mock).mock.calls[0]?.[1]?.body ?? '');
    expect(prompt).not.toContain('Employee mentioned: Si');
    expect(prompt).not.toContain('HR Intelligence · sync:');
  });

  it('rejects Gemini First Intercom on the screenshot subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    employee: {
                      name: 'First Intercom',
                      evidence: 'First Intercom',
                      status: 'EXPLICIT_NAME_FOUND',
                      confidence: 100
                    },
                    classification: { category: 'general', confidence: 40 },
                    issueSummary: 'The message is a test conversation without a specific HR issue.',
                    relatedCaseSearchTerms: []
                  })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'first intercom test conversation',
      messageBodies: ['first intercom test conversation'],
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com'
    });

    expect(result.names).toEqual([]);
    expect(result.employeeStatus).toBe('NO_EMPLOYEE_MENTIONED');
    expect(result.employeeConfidence).toBe(0);
    expect(result.caseType).toBe('general');
  });

  it('keeps a nested extraction-v2 employee name that is present in the subject', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    employee: {
                      name: 'Ayesha Khan',
                      evidence: 'Ayesha Khan',
                      status: 'EXPLICIT_NAME_FOUND',
                      confidence: 96
                    },
                    classification: { category: 'attendance', confidence: 91 },
                    issueSummary: 'The report concerns an attendance issue involving Ayesha Khan.',
                    relatedCaseSearchTerms: ['attendance', 'absence']
                  })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const { employeeNameExtractionService } = await import(
      '../../../src/modules/employee/employee.name-extraction.service.js'
    );

    const result = await employeeNameExtractionService.extract({
      subject: 'Attendance issue for Ayesha Khan',
      messageBodies: ['Ayesha Khan has been late this week.'],
      reporterName: 'Store Manager',
      reporterEmail: '1042@northwind.co'
    });

    expect(result.names).toEqual(['Ayesha Khan']);
    expect(result.employeeStatus).toBe('EXPLICIT_NAME_FOUND');
    expect(result.caseType).toBe('attendance');
    expect(result.relatedCaseSearchTerms).toEqual(['attendance', 'absence']);
  });
});
