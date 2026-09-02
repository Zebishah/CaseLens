import { jest } from '@jest/globals';

const mockFindFirstMessageBodies = jest.fn<() => Promise<Map<number, string>>>();

await jest.unstable_mockModule(
  '../../../src/modules/conversation/conversation.repository.js',
  () => ({
    conversationRepository: {
      findFirstMessageBodiesByConversationIds: mockFindFirstMessageBodies
    }
  })
);

await jest.unstable_mockModule('../../../src/config/gemini.config.js', () => ({
  geminiConfig: {
    apiKey: 'test-key',
    model: 'gemini-test'
  }
}));

const { relatedCaseSummaryService } = await import(
  '../../../src/modules/intelligence/related-case-summary.service.js'
);

const geminiSummary = (summary: string) =>
  ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ summary }) }]
          }
        }
      ]
    })
  }) as Response;

const relatedCase = (overrides: Record<string, unknown> = {}) => ({
  conversationId: 2,
  intercomId: 'rel-1',
  subject: 'Charles smoking weed',
  caseType: 'misconduct',
  matchedEmployeeNames: ['Charles Xavier'],
  reporterName: null,
  status: 'open',
  advisorName: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  previewText: 'Charles was smoking weed at work and refused to leave.',
  ...overrides
});

describe('relatedCaseSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirstMessageBodies.mockResolvedValue(
      new Map([[2, '<p>Charles was smoking weed at work and refused to leave.</p>']])
    );
  });

  it('returns a single paragraph and never cuts mid-sentence', () => {
    const clipped = relatedCaseSummaryService.clampSummaryText(
      'Ryan missed several shifts. He also arrived late repeatedly. A follow-up review is planned.',
      45
    );
    expect(clipped).toBe('Ryan missed several shifts.');
    expect(clipped).not.toContain('…');
    expect(clipped).not.toContain('\n');
  });

  it('parses structured Gemini JSON into one paragraph', () => {
    const summary = relatedCaseSummaryService.parseStructuredSummaryText(
      JSON.stringify({
        summary:
          'Rayan keeps disrupting class. Learning time for other students suffers. Staff want a behaviour plan agreed soon.'
      })
    );
    expect(summary).not.toContain('\n');
    expect(summary.startsWith('Rayan keeps disrupting class.')).toBe(true);
  });

  it('recovers a complete sentence from truncated Gemini JSON', () => {
    const summary = relatedCaseSummaryService.parseStructuredSummaryText(
      '{"summary": "Ryan Burke has received a formal warning. He keeps missing shi'
    );
    expect(summary).toBe('Ryan Burke has received a formal warning.');
    expect(summary).not.toContain('{');
  });

  it('returns nothing when the payload is unusable JSON', () => {
    expect(relatedCaseSummaryService.parseStructuredSummaryText('{"summary": "Ryan')).toBe('');
    expect(relatedCaseSummaryService.parseStructuredSummaryText('{"other": 1}')).toBe('');
  });

  it('requests the answer without thinking tokens so JSON is not truncated', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        geminiSummary(
          'Charles used drugs on shift. He refused to leave. HR should open a conduct case.'
        )
      );

    await relatedCaseSummaryService.attachSummaries([relatedCase()]);

    const requestInit = (global.fetch as jest.Mock).mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body ?? '{}'));
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });

  it('regenerates a stored summary that leaked raw JSON', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        geminiSummary(
          'A manager reported drug use on site. The employee stayed after being told to go. This needs a conduct review.'
        )
      );

    const [enriched] = await relatedCaseSummaryService.attachSummaries([
      relatedCase({ summaryText: '{"summary": "Ryan Burke has received a formal warning' })
    ]);

    expect(global.fetch).toHaveBeenCalled();
    expect(enriched?.summaryText).toContain('conduct review');
    expect(enriched?.summaryText).not.toContain('{');
  });

  it('asks for one paraphrased paragraph of 3 to 4 sentences for a long message', () => {
    const prompt = relatedCaseSummaryService.buildSummaryPrompt(
      'Ryan Burke attendance warning',
      'This document serves as a formal notice to record ongoing concerns about repeated unexcused absences, frequent lateness, and missed call-outs across recent weeks.'
    );
    expect(prompt).toContain('ONE short paragraph of 3 to 4 sentences');
    expect(prompt).toContain('YOUR OWN WORDS');
    expect(prompt).toContain('no line breaks');
  });

  it('asks for only 1 to 2 sentences when the message is one line', () => {
    const shortMessage = 'Sarah Patel Attendance is getting worse day by day';
    expect(relatedCaseSummaryService.resolveSentenceRange(shortMessage)).toMatchObject({
      minSentences: 1,
      maxSentences: 2
    });

    const prompt = relatedCaseSummaryService.buildSummaryPrompt(
      'Sarah Patel attendance',
      shortMessage
    );
    expect(prompt).toContain('ONE short paragraph of 1 to 2 sentences');
    expect(prompt).toContain('a one-line report gets a one-line summary');
  });

  it('accepts a one-sentence summary for a one-line message', async () => {
    mockFindFirstMessageBodies.mockResolvedValue(
      new Map([[2, '<p>Sarah Patel Attendance is getting worse day by day</p>']])
    );
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(geminiSummary('Sarah keeps turning up late and her attendance is slipping.'));

    const [enriched] = await relatedCaseSummaryService.attachSummaries([
      relatedCase({
        subject: 'Sarah Patel attendance',
        previewText: 'Sarah Patel Attendance is getting worse day by day'
      })
    ]);

    expect(enriched?.summaryText).toBe(
      'Sarah keeps turning up late and her attendance is slipping.'
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const requestInit = (global.fetch as jest.Mock).mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body ?? '{}'));
    expect(body.generationConfig.responseSchema.properties.summary.description).toContain('1-2');
  });

  it('detects verbatim copies of the original message', () => {
    const source =
      'This document serves as a formal notice to record ongoing concerns regarding Ryan Burke workplace attendance record.';
    expect(
      relatedCaseSummaryService.isTooSimilarToPreview(
        'This document serves as a formal notice to record ongoing concerns.',
        source
      )
    ).toBe(true);
    expect(
      relatedCaseSummaryService.isTooSimilarToPreview(
        'Ryan keeps missing shifts without telling anyone. Managers want the pattern corrected now.',
        source
      )
    ).toBe(false);
  });

  it('attaches a paragraph summary using a structured schema request', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        geminiSummary(
          'Charles used drugs during his shift. He would not leave when managers asked. HR should treat it as a conduct case.'
        )
      );

    const [enriched] = await relatedCaseSummaryService.attachSummaries([relatedCase()]);

    expect(enriched?.summaryText).toContain('conduct case');
    expect(enriched?.summaryText).not.toContain('\n');
    expect(enriched?.previewText).toBe('Charles was smoking weed at work and refused to leave.');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const requestInit = (global.fetch as jest.Mock).mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body ?? '{}'));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toContain('summary');
  });

  it('keeps a stored paraphrase and skips another Gemini call', async () => {
    global.fetch = jest.fn<typeof fetch>();

    const stored =
      'A report alleges drug use on shift. He ignored orders to go home. Advisors should open a review.';
    const [enriched] = await relatedCaseSummaryService.attachSummaries([
      relatedCase({ summaryText: stored })
    ]);

    expect(enriched?.summaryText).toBe(stored);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('regenerates when the stored summary is copied from the message', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        geminiSummary(
          'A manager reported drug use on site. The employee stayed after being told to go. This needs a formal conduct review.'
        )
      );

    const preview = 'Charles was smoking weed at work and refused to leave.';
    const [enriched] = await relatedCaseSummaryService.attachSummaries([
      relatedCase({ summaryText: preview })
    ]);

    expect(enriched?.summaryText).toContain('conduct review');
    expect(enriched?.summaryText).not.toBe(preview);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('retries once when Gemini echoes the message, then drops unusable drafts', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        geminiSummary(
          'Charles was smoking weed at work and refused to leave. Charles was smoking weed at work and refused to leave. Charles was smoking weed at work.'
        )
      );

    const [enriched] = await relatedCaseSummaryService.attachSummaries([relatedCase()]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(enriched?.summaryText).toBeNull();
  });

  it('falls back to preview-only when Gemini fails', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      text: async () => 'quota'
    } as Response);

    const [enriched] = await relatedCaseSummaryService.attachSummaries([
      relatedCase({ previewText: 'Fallback preview text' })
    ]);

    expect(enriched?.summaryText).toBeUndefined();
    expect(enriched?.previewText).toBe('Fallback preview text');
  });
});
