import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';

const OPTS = { headingStyle: 'atx' as const, bulletListMarker: '-' as const };

describe('htmlToMarkdown', () => {
  it('converts headings and paragraphs', () => {
    expect(htmlToMarkdown('<h1>Hello</h1><p>World</p>', OPTS)).toBe('# Hello\n\nWorld');
  });

  it('trims trailing newlines', () => {
    expect(htmlToMarkdown('<p>x</p>', OPTS)).toBe('x');
  });

  it('flattens single-paragraph list items (tight list)', () => {
    expect(htmlToMarkdown('<ul><li><p>a</p></li><li><p>b</p></li></ul>', OPTS))
      .toBe('-   a\n-   b');
  });

  it('keeps loose formatting for multi-paragraph list items', () => {
    expect(htmlToMarkdown('<ul><li><p>a</p><p>b</p></li></ul>', OPTS))
      .toBe('-   a\n    \n    b');
  });

  it('removes script and style elements', () => {
    expect(htmlToMarkdown('<p>keep</p><script>bad()</script><style>.x{}</style>', OPTS))
      .toBe('keep');
  });

  it('renders GFM tables', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead>'
      + '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    expect(htmlToMarkdown(html, OPTS)).toBe('| A   | B   |\n| --- | --- |\n| 1   | 2   |');
  });
});
