import {
  inspectSanitizedAnalysisInput,
  isApplicationGeneratedContent,
  selectCustomerConversationMessages
} from '../../../src/modules/intelligence/customer-conversation-content.util.js';
import { buildExtractionV2UserPrompt } from '../../../src/modules/employee/employee.extraction-v2.prompt.js';

const SI_SUBJECT = 'this si the issue that is faced and test workspace';

const leakedNote = [
  '<p><strong>HR Intelligence</strong><br/>HR Intelligence · sync:abcdef123456</p>',
  '<p>Employee mentioned: Si<br/>Confidence: —<br/>Status: Not matched to directory',
  '<br/>Category: Attendance<br/>Related cases: 0</p>'
].join('');

describe('customer conversation content allowlist', () => {
  it('keeps only genuine customer/contact case content', () => {
    const selected = selectCustomerConversationMessages({
      subject: SI_SUBJECT,
      source: {
        id: 'src-1',
        partType: 'comment',
        authorType: 'user',
        body: SI_SUBJECT
      },
      parts: [
        {
          id: 'note-1',
          partType: 'note',
          authorType: 'admin',
          body: leakedNote
        },
        {
          id: 'admin-1',
          partType: 'comment',
          authorType: 'admin',
          body: 'Operator reply with Ayesha Khan'
        },
        {
          id: 'bot-1',
          partType: 'comment',
          authorType: 'bot',
          body: 'Thanks for contacting HR'
        },
        {
          id: 'assign-1',
          partType: 'assignment',
          authorType: 'admin',
          body: 'assigned'
        },
        {
          id: 'user-2',
          partType: 'comment',
          authorType: 'user',
          body: 'adding more detail from the store'
        }
      ]
    });

    expect(selected.included.map((part) => part.id)).toEqual(['src-1', 'user-2']);
    expect(selected.excluded.map((part) => part.reason)).toEqual(
      expect.arrayContaining([
        'disallowed_part_type',
        'disallowed_author_type',
        'application_generated'
      ])
    );
  });

  it('never puts application notes, tags, or previous AI output into the Gemini user prompt', () => {
    const inspection = inspectSanitizedAnalysisInput({
      subject: SI_SUBJECT,
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'reporter@example.com',
      source: {
        id: 'src-1',
        partType: 'comment',
        authorType: 'user',
        body: SI_SUBJECT
      },
      parts: [
        {
          id: 'note-1',
          partType: 'note',
          authorType: 'admin',
          body: leakedNote
        }
      ],
      tags: ['hr-intelligence-processed', 'category-hr-intelligence-processed', 'manual-review']
    });

    expect(inspection.subject).toBe(SI_SUBJECT);
    expect(inspection.customerMessageBodies).toEqual([SI_SUBJECT]);
    expect(inspection.reporterName).toBe('Syed Zohaib Haider');
    expect(inspection.tags).toEqual([
      'hr-intelligence-processed',
      'category-hr-intelligence-processed',
      'manual-review'
    ]);
    expect(inspection.modelUserPrompt).toBe(
      buildExtractionV2UserPrompt({
        subject: SI_SUBJECT,
        messageBody: SI_SUBJECT,
        reporterName: 'Syed Zohaib Haider',
        reporterEmail: 'reporter@example.com'
      })
    );
    expect(inspection.modelUserPrompt).not.toContain('HR Intelligence');
    expect(inspection.modelUserPrompt).not.toContain('hr-intelligence-processed');
    expect(inspection.modelUserPrompt).not.toContain('category-hr-intelligence-processed');
    expect(inspection.modelUserPrompt).not.toContain('Employee mentioned: Si');
    expect(inspection.modelUserPrompt).not.toContain('Category: Attendance');
    expect(inspection.containsApplicationOutput).toBe(false);
  });

  it('detects application-generated notes by the durable sync marker', () => {
    expect(isApplicationGeneratedContent(leakedNote)).toBe(true);
    expect(isApplicationGeneratedContent(SI_SUBJECT)).toBe(false);
  });
});
