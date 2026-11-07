import { CANVAS_COPY } from '../../../src/constants/canvas.constants.js';
import { INTERCOM_CASE_TYPES } from '../../../src/constants/intercom.constants.js';
import { canvasBuilder } from '../../../src/modules/canvas/canvas.builder.js';

describe('canvasBuilder', () => {
  it('builds configure confirmation canvas', () => {
    const canvas = canvasBuilder.buildConfigure();

    expect(canvas.canvas.content.components[0]).toMatchObject({
      type: 'text',
      style: 'header',
      text: 'Case Lense'
    });
  });

  it('builds pending and failed states', () => {
    expect(canvasBuilder.buildPending().canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.PROCESSING_DETAIL }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: 'Refresh results',
          style: 'link'
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE,
          style: 'link'
        })
      ])
    );

    expect(canvasBuilder.buildFailed('worker error').canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.FAILED }),
        expect.objectContaining({ text: CANVAS_COPY.FAILED_DETAIL, style: 'muted' }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: 'Refresh results',
          style: 'link'
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE,
          style: 'link'
        })
      ])
    );
    expect(JSON.stringify(canvasBuilder.buildFailed('worker error'))).not.toContain('worker error');
  });

  it('builds pending preview with reporter and case category when available', () => {
    const canvas = canvasBuilder.buildPending({
      reporterName: 'Syed Zohaib Haider',
      subject: 'Jonathan Fritsch - attendance issue',
      rawPayload: null
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: 'Reporter: Syed Zohaib Haider'
        }),
        expect.objectContaining({
          style: 'muted',
          text: expect.stringContaining('Case category:')
        }),
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.PROCESSING_DETAIL })
      ])
    );
  });

  it('shows searching company domain progress state', () => {
    const canvas = canvasBuilder.buildSearchingCompanyDomain({
      reporterName: 'Store Reporter',
      caseType: 'attendance',
      subject: 'Attendance issue',
      rawPayload: null
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: CANVAS_COPY.SEARCHING_COMPANY_DOMAIN
        }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: CANVAS_COPY.REFRESH_RESULTS
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE
        })
      ])
    );
  });

  it('always shows refresh button when snapshot is current', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Michael Jones',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { banner: 'current' }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', style: 'header', text: 'Case Lense' }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: CANVAS_COPY.REFRESH_RESULTS
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.SHOWING_LAST_ANALYZED })
      ])
    );
  });

  it('shows a compact system state and safe match evidence in the client sidebar', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Ayesha Sophie',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      relatedCases: [],
      intelligenceVersion: '38:1:1788344456000',
      processedAt: '2026-09-02T10:37:42.442Z'
    });

    const text = JSON.stringify(canvas);
    expect(text).toContain(`${CANVAS_COPY.PROCESSING_VERSION_PREFIX}: v38`);
    expect(text).toContain(`${CANVAS_COPY.LAST_UPDATED_PREFIX}: Sep 2, 2026`);
    expect(text).toContain(CANVAS_COPY.IDENTITY_EVIDENCE_PREFIX);
    expect(text).not.toContain('38:1:1788344456000');
    expect(text).not.toContain('2026-09-02T10:37:42.442Z');
    expect(text).toContain('Matched · 100%');
  });

  it('shows pending-update banner and refresh button when subject changed', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Michael Jones',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      { banner: 'pending-update' }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATES_PENDING }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: CANVAS_COPY.REFRESH_RESULTS
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE
        })
      ])
    );
  });

  it('treats domain-search-pending like a refresh pending state without domain button', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        relatedCases: [],
        awaitingCompanyDomainSearch: true,
        processedAt: new Date().toISOString()
      },
      {
        banner: 'domain-search-pending',
        scopeSearch: { storeNumber: '10206', companyDomain: 'demoops.co' }
      }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.UPDATING_INTELLIGENCE }),
        expect.objectContaining({ style: 'muted', text: CANVAS_COPY.REFRESH_STILL_UPDATING_HINT }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: CANVAS_COPY.REFRESH_RESULTS
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'search-company-domain' })
      ])
    );
  });

  it('does not show company domain scope button', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [
          {
            employeeIdentityId: 1,
            canonicalName: 'Zebi Shah',
            confidenceScore: 85,
            matchMethod: 'token'
          }
        ],
        awaitingCompanyDomainSearch: false,
        companyDomainSearchAttempted: true,
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      {
        scopeSearch: { storeNumber: '10206', companyDomain: 'demoops.co' }
      }
    );

    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'search-company-domain' })
      ])
    );
  });

  it('shows employee search notices without domain search button', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        employeeSearchNotices: ['No employee match found using store number 3456.'],
        awaitingCompanyDomainSearch: true,
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      {
        scopeSearch: { storeNumber: '3456', companyDomain: 'demoops.co' }
      }
    );

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: 'No employee match found using store number 3456.'
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'search-company-domain' })
      ])
    );
  });

  it('hides automatic-create notices after the false employee path was removed', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [],
      employeeMentionStatus: 'no_employee_mentioned',
      employeeSearchNotices: [
        'No matching employee found — created a new employee record.',
        'Possible duplicate: Jonathan Thomas (63%)'
      ],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: 'No matching employee found — created a new employee record.'
        })
      ])
    );
  });

  it('shows no employee identified for the screenshot subject', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      caseType: 'general',
      employeeMatches: [],
      employeeMentionStatus: 'no_employee_mentioned',
      mentionedInReport: [],
      relatedCases: [],
      employeeMatchConfidence: 0,
      requiresManualReview: false,
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED }),
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED_STATUS }),
        expect.objectContaining({ text: CANVAS_COPY.NO_RELATED_CASES_NO_EMPLOYEE })
      ])
    );
    expect(JSON.stringify(canvas)).not.toContain('First Intercom');
    expect(JSON.stringify(canvas)).not.toContain('100%');
  });

  it('does not show a rejected typo as an unresolved employee mention', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      caseType: 'general',
      employeeMatches: [],
      employeeMentionStatus: 'no_employee_mentioned',
      unresolvedEmployeeMention: null,
      mentionedInReport: ['Si'],
      relatedCases: [],
      employeeMatchConfidence: 0,
      requiresManualReview: false,
      processedAt: new Date().toISOString()
    });

    const text = JSON.stringify(canvas);
    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED }),
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED_STATUS }),
        expect.objectContaining({ text: `${CANVAS_COPY.CASE_CATEGORY_PREFIX}: General` })
      ])
    );
    expect(text).not.toContain('Employee mentioned: Si');
    expect(text).not.toContain(CANVAS_COPY.REVIEW_REQUIRED);
    expect(text).not.toContain(CANVAS_COPY.MANUAL_REVIEW);
  });

  it('shows an unresolved mention without treating it as a confirmed employee', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [],
      employeeMentionStatus: 'unresolved',
      unresolvedEmployeeMention: 'Ayesha Khan',
      mentionedInReport: ['Ayesha Khan'],
      relatedCases: [],
      requiresManualReview: true,
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Employee mentioned: Ayesha Khan' }),
        expect.objectContaining({ text: CANVAS_COPY.UNRESOLVED_DIRECTORY_MATCH }),
        expect.objectContaining({ text: CANVAS_COPY.REVIEW_REQUIRED })
      ])
    );
  });

  it('shows related cases for an unresolved mentioned name', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [],
      employeeMentionStatus: 'unresolved',
      unresolvedEmployeeMention: 'Braden',
      mentionedInReport: ['Braden'],
      relatedCases: [
        {
          conversationId: 18,
          intercomId: '215475747334934',
          subject: 'Braeden is talking shit in office and handling work badly',
          caseType: 'conduct',
          matchedEmployeeNames: ['Braeden'],
          reporterName: 'Syed Zohaib Haider',
          status: 'open',
          advisorName: null,
          createdAt: '2026-09-02T09:00:00.000Z'
        }
      ],
      requiresManualReview: true,
      processedAt: new Date().toISOString()
    });

    const text = JSON.stringify(canvas);
    expect(text).toContain('Braeden is talking shit in office and handling work badly');
    expect(text).not.toContain(CANVAS_COPY.NO_RELATED_CASES_NO_EMPLOYEE);
  });

  it('does not show company domain button for older awaiting snapshots', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot(
      {
        employeeMatches: [],
        employeeSearchNotices: ['No employee match found using store number 3456.'],
        awaitingCompanyDomainSearch: true,
        companyDomainSearchAttempted: true,
        relatedCases: [],
        processedAt: new Date().toISOString()
      },
      {
        scopeSearch: { storeNumber: '3456', companyDomain: 'demoops.co' }
      }
    );

    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'search-company-domain'
        })
      ])
    );
  });

  it('hides in-progress domain search notice once an employee match exists', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Michael Jones',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      employeeSearchNotices: ['Searching employees for company domain acmecorp.com.'],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Searching employees for company domain acmecorp.com.'
        })
      ])
    );
    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'list' })
      ])
    );
  });

  it('shows case category for the open conversation', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      caseType: 'misconduct',
      employeeMatches: [],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: 'Case category: Conduct'
        })
      ])
    );
  });

  it('shows employee names mentioned in the report above employee match', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      caseType: 'coaching',
      mentionedInReport: ['Myabu Nagumis', 'Takishi yagimo'],
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Miyabi Nagumo',
          confidenceScore: 85,
          matchMethod: 'token',
          extractedName: 'Myabu Nagumis'
        }
      ],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          style: 'muted',
          text: 'Employees mentioned in report: Myabu Nagumis, Takishi yagimo'
        })
      ])
    );

    const listComponents = canvas.canvas.content.components.filter(
      (component) => component.type === 'list'
    );
    expect(listComponents[0]?.items[0]?.subtitle).toContain('Name match · 85%');
    expect(listComponents[0]?.items[0]?.subtitle).toContain('Also written as: Myabu Nagumis');
  });

  it('builds employee match and related case sections from snapshot', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Mohammad Nehaal',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      relatedCases: [
        {
          conversationId: 2,
          intercomId: '215474091120045',
          subject: 'employee issue',
          caseType: INTERCOM_CASE_TYPES.GENERAL,
          matchedEmployeeNames: ['Mohammad Nehaal'],
          reporterName: 'Jon Fritz',
          status: 'open',
          advisorName: 'Crystal',
          createdAt: '2026-04-28T10:00:00.000Z'
        }
      ],
      processedAt: new Date().toISOString()
    });

    const components = canvas.canvas.content.components;
    const listComponents = components.filter((component) => component.type === 'list');
    const dismissButtons = components.filter(
      (component) => component.type === 'button' && component.label === '✕ Remove'
    );

    expect(listComponents).toHaveLength(2);
    expect(components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'header',
          text: CANVAS_COPY.CATEGORY_CASES_HEADER
        })
      ])
    );
    expect(dismissButtons).toHaveLength(1);
    expect(dismissButtons[0]).toMatchObject({
      id: 'dismiss-related-215474091120045',
      style: 'link',
      label: '✕ Remove',
      action: { type: 'submit' }
    });
    expect(listComponents[0]?.items[0]).toMatchObject({
      title: 'Mohammad Nehaal',
      subtitle: 'Matched · 100%'
    });
    expect(listComponents[1]?.items[0]).toMatchObject({
      title: 'employee issue',
      subtitle: expect.stringContaining('Case #215474091120045'),
      action: {
        type: 'url',
        url: expect.stringContaining('215474091120045')
      }
    });
    expect(listComponents[1]?.items[0]?.subtitle).not.toContain('Employee:');
    expect(listComponents[1]?.items[0]?.subtitle).not.toContain('Reporter:');
    expect(components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'paragraph',
          text: 'employee issue'
        })
      ])
    );
  });

  it('hides dismissed related cases when rendering a stored snapshot', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 8,
          canonicalName: 'Dupe Santiago',
          confidenceScore: 96,
          matchMethod: 'exact'
        }
      ],
      employeeMentionStatus: 'resolved',
      relatedCases: [
        {
          conversationId: 2,
          intercomId: '215475436369376',
          subject: 'Dupe Tahliq Wilkes Customer complaints',
          caseType: INTERCOM_CASE_TYPES.CONDUCT,
          matchedEmployeeNames: ['Dupe Santiago'],
          reporterName: 'Richard Gaylor',
          status: 'closed',
          advisorName: null,
          createdAt: '2026-08-12T10:00:00.000Z'
        },
        {
          conversationId: 3,
          intercomId: '215475451867178',
          subject: 'Dupe Murry Wright Verbal Harassment Store 4280',
          caseType: INTERCOM_CASE_TYPES.CONDUCT,
          matchedEmployeeNames: ['Dupe Santiago'],
          reporterName: 'Ella Gideon',
          status: 'open',
          advisorName: null,
          createdAt: '2026-08-12T11:00:00.000Z'
        }
      ],
      dismissedRelatedCaseIntercomIds: ['215475436369376'],
      processedAt: new Date().toISOString()
    });

    const dismissButtons = canvas.canvas.content.components.filter(
      (component) => component.type === 'button' && component.label === '✕ Remove'
    );

    expect(dismissButtons).toHaveLength(1);
    expect(dismissButtons[0]).toMatchObject({
      id: 'dismiss-related-215475451867178'
    });
  });

  it('deduplicates the same spelling when extracted name and alias variant match', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 12,
          canonicalName: 'Miyabi Nagumo',
          confidenceScore: 85,
          matchMethod: 'token',
          extractedName: 'Merabi Magumo',
          nameVariants: [
            {
              variantName: 'Merabi Magumo',
              confidenceScore: 100,
              matchMethod: 'exact'
            }
          ]
        }
      ],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    const listComponents = canvas.canvas.content.components.filter(
      (component) => component.type === 'list'
    );

    expect(listComponents[0]?.items[0]?.subtitle).toBe(
      'Name match · 85% · Also written as: Merabi Magumo'
    );
  });

  it('shows similar name variants under employee match', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 4,
          canonicalName: 'Johan Liebert',
          confidenceScore: 100,
          matchMethod: 'exact',
          nameVariants: [
            {
              variantName: 'John Liebert',
              confidenceScore: 78,
              matchMethod: 'token'
            }
          ]
        }
      ],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    const listComponents = canvas.canvas.content.components.filter(
      (component) => component.type === 'list'
    );

    expect(listComponents[0]?.items[0]?.subtitle).toContain('Also written as: John Liebert');
  });

  it('separates close cases from other employee history with clear evidence copy', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 12,
          canonicalName: 'Ayesha Sophie',
          confidenceScore: 99,
          matchMethod: 'token'
        }
      ],
      relatedCases: [
        {
          conversationId: 20,
          intercomId: 'attendance-case',
          subject: 'Attendance concern for Ayisha Sophie',
          caseType: 'attendance',
          matchedEmployeeNames: ['Ayisha Sophie'],
          reporterName: null,
          status: 'open',
          advisorName: null,
          createdAt: '2026-09-01T00:00:00.000Z',
          relationshipGroup: 'closely_related',
          relationshipEvidence: ['Same employee', 'Same category: attendance']
        },
        {
          conversationId: 21,
          intercomId: 'performance-case',
          subject: 'Performance concern for Ayesha Sophi',
          caseType: 'coaching',
          matchedEmployeeNames: ['Ayesha Sophi'],
          reporterName: null,
          status: 'open',
          advisorName: null,
          createdAt: '2026-09-01T00:00:00.000Z',
          relationshipGroup: 'employee_history',
          relationshipEvidence: ['Same employee', 'Different category: coaching']
        }
      ],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'header',
          text: 'Closely related cases'
        }),
        expect.objectContaining({
          type: 'text',
          style: 'header',
          text: 'Other cases for this employee'
        }),
        expect.objectContaining({
          type: 'text',
          style: 'muted',
          text: 'Why this appears: Same employee · Different category: coaching'
        })
      ])
    );
  });

  it('builds possible same person section when token matches exist', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 5,
          canonicalName: 'Zohaib shah',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      possibleSamePerson: [
        {
          employeeIdentityId: 3,
          canonicalName: 'Syed Zohaib Haider',
          confidenceScore: 75,
          matchMethod: 'token',
          sharedTokens: ['zohaib']
        }
      ],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', style: 'header', text: 'Possible same person' }),
        expect.objectContaining({
          type: 'list',
          items: [
            expect.objectContaining({
              title: 'Syed Zohaib Haider',
              subtitle: expect.stringContaining('similar names: zohaib')
            })
          ]
        })
      ])
    );
  });

  it('builds empty employee and related states inside ready snapshot', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [],
      relatedCases: [],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED }),
        expect.objectContaining({ text: CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED_STATUS }),
        expect.objectContaining({
          text: CANVAS_COPY.NO_RELATED_CASES_NO_EMPLOYEE
        }),
        expect.objectContaining({
          type: 'button',
          id: 'refresh-intelligence',
          label: 'Refresh results'
        }),
        expect.objectContaining({
          type: 'button',
          id: 'reanalyze-intelligence',
          label: CANVAS_COPY.REANALYZE_CASE
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: CANVAS_COPY.CATEGORY_CASES_HEADER
        })
      ])
    );
  });

  it('shows opening message preview on related case cards instead of employee/reporter labels', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Zebi Shah',
          confidenceScore: 85,
          matchMethod: 'token'
        }
      ],
      relatedCases: [
        {
          conversationId: 2,
          intercomId: 'related-001',
          subject: 'attendance issue - zebi',
          caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
          matchedEmployeeNames: ['zebi', 'Zebi Shah'],
          reporterName: 'dd1976demoops',
          reporterStoreNumber: 'dd1976',
          reporterCompanyDomain: 'demoops.co',
          status: 'open',
          advisorName: null,
          createdAt: '2026-07-01T00:00:00.000Z',
          previewText: 'Zebi called out again this morning without notice'
        }
      ],
      processedAt: new Date().toISOString()
    });

    const components = canvas.canvas.content.components;
    const relatedList = components.find(
      (component) =>
        component.type === 'list' &&
        component.items?.[0]?.id === 'related-related-001'
    );

    expect(relatedList?.items?.[0]?.subtitle).toContain('Open');
    expect(relatedList?.items?.[0]?.subtitle).toContain('Case #related-001');
    expect(relatedList?.items?.[0]?.subtitle).not.toContain('Zebi called out');
    expect(relatedList?.items?.[0]?.subtitle).not.toContain('Employee:');
    expect(components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'paragraph',
          text: 'Zebi called out again this morning without notice'
        })
      ])
    );
  });

  it('prefers AI summaryText over first-message previewText under related cases', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Zebi Shah',
          confidenceScore: 85,
          matchMethod: 'token'
        }
      ],
      relatedCases: [
        {
          conversationId: 2,
          intercomId: 'related-002',
          subject: 'attendance issue - zebi',
          caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
          matchedEmployeeNames: ['Zebi Shah'],
          reporterName: null,
          status: 'open',
          advisorName: null,
          createdAt: '2026-07-01T00:00:00.000Z',
          previewText: 'Raw opening message that should be hidden',
          summaryText:
            'Zebi has repeated attendance issues. He called out without notice again. This needs a manager follow-up.'
        }
      ],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'paragraph',
          text: 'Zebi has repeated attendance issues. He called out without notice again. This needs a manager follow-up.'
        })
      ])
    );
    expect(canvas.canvas.content.components).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Raw opening message that should be hidden'
        })
      ])
    );
  });

  it('falls back to subject on related case cards when preview is missing', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [
        {
          employeeIdentityId: 164,
          canonicalName: 'Mike Smith',
          confidenceScore: 68,
          matchMethod: 'token',
          extractedName: 'Mike John'
        }
      ],
      mentionedInReport: ['Mike John'],
      relatedCases: [
        {
          conversationId: 2,
          intercomId: 'related-john',
          subject: 'John smith attendance issue',
          caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
          matchedEmployeeNames: ['John Smith'],
          reporterName: '10206demoops',
          status: 'open',
          createdAt: '2026-07-02T00:00:00.000Z'
        },
        {
          conversationId: 3,
          intercomId: 'related-mike-s',
          subject: 'Mike S. serious attendance warning',
          caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
          matchedEmployeeNames: ['Mike S.'],
          reporterName: '10206demoops',
          status: 'open',
          createdAt: '2026-07-02T00:00:00.000Z'
        }
      ],
      processedAt: new Date().toISOString()
    });

    const previewTexts = canvas.canvas.content.components
      .filter((component) => component.type === 'text' && component.style === 'paragraph')
      .map((component) => component.text ?? '');

    expect(previewTexts).toEqual(
      expect.arrayContaining([
        'John smith attendance issue',
        'Mike S. serious attendance warning'
      ])
    );
  });

  it('shows possible related cases for close name spellings', () => {
    const canvas = canvasBuilder.buildIntelligenceSnapshot({
      employeeMatches: [],
      employeeMentionStatus: 'unresolved',
      unresolvedEmployeeMention: 'Braden',
      mentionedInReport: ['Braden'],
      relatedCases: [],
      fuzzyRelatedCases: [
        {
          conversationId: 9,
          intercomId: 'fuzzy-braeden',
          subject: 'Braeden is talking shit in office and handling work badly',
          caseType: 'conduct',
          matchedEmployeeNames: ['Braeden'],
          reporterName: 'Syed Zohaib Haider',
          status: 'open',
          advisorName: null,
          createdAt: '2026-09-02T09:00:00.000Z',
          fuzzyMatchScore: 86,
          fuzzyMatchedName: 'Braeden',
          fuzzySharedTokens: ['braden~braeden']
        }
      ],
      processedAt: new Date().toISOString()
    });

    expect(canvas.canvas.content.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          style: 'header',
          text: CANVAS_COPY.FUZZY_RELATED_CASES_HEADER
        })
      ])
    );
    expect(JSON.stringify(canvas)).toContain(
      'Braeden is talking shit in office and handling work badly'
    );
  });
});
