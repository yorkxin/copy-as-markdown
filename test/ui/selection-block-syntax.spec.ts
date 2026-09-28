import { afterEach, describe, expect, it } from 'vitest';
import { extractSelectionHtml } from '../../src/content-scripts/extract-selection-html.js';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';
import SelectionSettings from '../../src/lib/selection-settings.js';
import { createFakeSyncStorage } from '../support/fake-sync-storage.js';

const storage = createFakeSyncStorage();
const ticks = String.fromCharCode(96).repeat(3);

afterEach(() => {
  storage.uninstall();
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

async function convert(html: string, stored: Record<string, unknown>): Promise<string> {
  storage.data = stored;
  storage.install();
  document.body.innerHTML = html;
  const range = document.createRange();
  range.selectNodeContents(document.body);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  return htmlToMarkdown(extractSelectionHtml(false), await SelectionSettings.getAll());
}

describe('copy selection heading and fence syntax', () => {
  const headings = '<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>';

  it('keeps ATX headings at every level by default and when explicitly selected', async () => {
    const expected = '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six';
    expect(await convert(headings, {})).toBe(expected);
    expect(await convert(headings, { 'selection.markdown.headingStyle': 'atx' })).toBe(expected);
  });

  it('uses Setext for H1 and H2 while H3 through H6 remain ATX', async () => {
    expect(await convert(headings, { 'selection.markdown.headingStyle': 'setext' }))
      .toBe('One\n===\n\nTwo\n---\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six');
  });

  it.each([
    ['default', {}, ticks],
    ['backticks', { 'selection.markdown.fence': ticks }, ticks],
    ['tildes', { 'selection.markdown.fence': '~~~' }, '~~~'],
  ])('uses %s fences and preserves the language tag', async (_name, stored, marker) => {
    expect(await convert('<pre><code class="language-js">const x = 1;\n</code></pre>', stored))
      .toBe(`${marker}js\nconst x = 1;\n${marker}`);
  });

  it.each([
    ['backticks', ticks],
    ['tildes', '~~~'],
  ])('lengthens %s fences for matching fence-like runs inside code', async (_name, marker) => {
    const code = `${marker}\ninside\n${marker}\n`;
    const html = `<pre><code class="language-js">${code}</code></pre>`;
    expect(await convert(html, { 'selection.markdown.fence': marker }))
      .toBe(`${marker}${marker[0]}js\n${code}${marker}${marker[0]}`);
  });

  it('ignores the saved fence while code blocks are indented and reuses it when fenced again', async () => {
    const html = '<pre><code class="language-js">const x = 1;\n</code></pre>';
    const stored = {
      'selection.markdown.codeBlockStyle': 'indented',
      'selection.markdown.fence': '~~~',
    };
    expect(await convert(html, stored)).toBe('    const x = 1;');
    expect(stored['selection.markdown.fence']).toBe('~~~');
    expect(await convert(html, { ...stored, 'selection.markdown.codeBlockStyle': 'fenced' }))
      .toBe('~~~js\nconst x = 1;\n~~~');
  });

  it('falls back per invalid stored setting without rewriting sync storage', async () => {
    const stored = {
      'selection.markdown.headingStyle': 'future',
      'selection.markdown.fence': '~~~',
    };
    const before = { ...stored };
    const html = '<h1>One</h1><pre><code>x\n</code></pre>';
    expect(await convert(html, stored)).toBe('# One\n\n~~~\nx\n~~~');
    expect(storage.data).toEqual(before);
  });
});
