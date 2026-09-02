import {
  RELATED_CASE_PREVIEW_MAX_CHARS,
  formatRelatedCasePreviewText
} from '../../../src/modules/intelligence/related-case-preview.util.js';

describe('formatRelatedCasePreviewText', () => {
  it('returns null for empty bodies', () => {
    expect(formatRelatedCasePreviewText(null)).toBeNull();
    expect(formatRelatedCasePreviewText('   ')).toBeNull();
  });

  it('strips html and collapses whitespace', () => {
    expect(formatRelatedCasePreviewText('<p>Marc is <b>late</b> again</p>')).toBe(
      'Marc is late again'
    );
  });

  it('truncates long text on a word boundary', () => {
    const body = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    const preview = formatRelatedCasePreviewText(body, 50);

    expect(preview).not.toBeNull();
    expect(preview!.endsWith('…')).toBe(true);
    expect(preview!.length).toBeLessThanOrEqual(51);
    expect(preview).not.toContain('word39');
  });

  it('uses the default max length constant', () => {
    const body = 'x'.repeat(RELATED_CASE_PREVIEW_MAX_CHARS + 20);
    const preview = formatRelatedCasePreviewText(body);

    expect(preview).not.toBeNull();
    expect(preview!.length).toBeLessThanOrEqual(RELATED_CASE_PREVIEW_MAX_CHARS + 1);
  });
});
