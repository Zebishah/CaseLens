import { stripHtmlToText } from '../../../src/utils/html.util.js';

describe('stripHtmlToText', () => {
  it('removes HTML tags and normalizes whitespace', () => {
    expect(stripHtmlToText('<p>Hello <b>Luis Castillo</b></p>')).toBe('Hello Luis Castillo');
  });
});
