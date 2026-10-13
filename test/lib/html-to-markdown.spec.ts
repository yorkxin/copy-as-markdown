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

  describe('gemini math', () => {
    const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    const frag = (latex: string, glyphs: string): string =>
      `<div data-xpm-math-type="inline"><img data-xpm-latex="${latex}" src="${GIF}">`
      + `<svg><text>${glyphs}</text></svg></div>`;

    it('emits inline TeX from the copy-root without escaping', () => {
      const html = '<div>using <span data-xpm-copy-root data-xpm-math-type="inline" '
        + 'data-xpm-latex="P = I^2 \\times R">'
        + `${frag('P ', '𝑃')}${frag('\\hphantom{}= I^2 ', '=𝐼2')}${frag('\\hphantom{}\\times R', '×𝑅')}`
        + '</span> now</div>';
      expect(htmlToMarkdown(html, OPTS)).toBe('using $P = I^2 \\times R$ now');
    });

    it('falls back to the image LaTeX when the root has none', () => {
      const html = '<div>x <span data-xpm-copy-root data-xpm-math-type="inline">'
        + `<img data-xpm-latex="V_{f}" src="${GIF}"><svg><text>𝑉</text></svg></span></div>`;
      expect(htmlToMarkdown(html, OPTS)).toBe('x $V_{f}$');
    });

    it('keeps block-tagged symbols inline within a sentence', () => {
      const html = '<div>Current (<div data-xpm-copy-root data-xpm-math-type="block" '
        + `data-xpm-latex="I"><img src="${GIF}"><svg><text>𝐼</text></svg></div>): 130mA</div>`;
      expect(htmlToMarkdown(html, OPTS)).toBe('Current ($I$): 130mA');
    });

    it('keeps TeX intact inside table cells', () => {
      const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>'
        + '<span data-xpm-copy-root data-xpm-math-type="block" data-xpm-latex="\\text{V}_{\\text{pp}}">'
        + `<img src="${GIF}"><svg><text>V</text></svg></span></td><td>2</td></tr></tbody></table>`;
      expect(htmlToMarkdown(html, OPTS))
        .toBe('| A   | B   |\n| --- | --- |\n| $\\text{V}_{\\text{pp}}$ | 2   |');
    });
  });

  describe('cleanup options', () => {
    const html = '<p>See <a href="https://example.com">the page</a> <img src="https://example.com/a.png" alt="pic"> now</p>';

    it('keeps links and images by default', () => {
      expect(htmlToMarkdown(html, OPTS))
        .toBe('See [the page](https://example.com) ![pic](https://example.com/a.png) now');
    });

    it('removes images', () => {
      expect(htmlToMarkdown(html, { ...OPTS, removeImages: true }))
        .toBe('See [the page](https://example.com)  now');
    });

    it('removes links but keeps their text', () => {
      expect(htmlToMarkdown(html, { ...OPTS, removeLinks: true }))
        .toBe('See the page ![pic](https://example.com/a.png) now');
    });

    it('removes chat boilerplate', () => {
      const chat = '<p>answer</p><p>Copied to clipboard</p><p>Share</p><p>Show allShow less</p>'
        + '<p>question</p><h3>AI Mode reply for question</h3><p>reply</p>';
      expect(htmlToMarkdown(chat, { ...OPTS, cleanChatExport: true }))
        .toBe('answer\n\n---\n\n## User\n\nquestion\n\n### Assistant\n\nreply');
    });
  });
});
