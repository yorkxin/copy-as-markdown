import { afterEach, describe, expect, it } from 'vitest';
import { extractSelectionHtml } from '../../src/content-scripts/extract-selection-html.js';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';
import SelectionSettings from '../../src/lib/selection-settings.js';
import { createFakeSyncStorage } from '../support/fake-sync-storage.js';

const storage = createFakeSyncStorage();

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

describe('copy selection link syntax', () => {
  const links = '<p><a href="https://example.com/one" title="First">One</a> and '
    + '<a href="https://example.com/two">Two</a></p>';
  const inline = '[One](https://example.com/one "First") and [Two](https://example.com/two)';

  it('preserves inline links by default and when explicitly selected', async () => {
    expect(await convert(links, {})).toBe(inline);
    expect(await convert(links, { 'selection.markdown.linkStyle': 'inlined' })).toBe(inline);
  });

  it.each([
    ['full', '[One][1] and [Two][2]\n\n[1]: https://example.com/one "First"\n[2]: https://example.com/two'],
    ['collapsed', '[One][] and [Two][]\n\n[One]: https://example.com/one "First"\n[Two]: https://example.com/two'],
    ['shortcut', '[One] and [Two]\n\n[One]: https://example.com/one "First"\n[Two]: https://example.com/two'],
  ])('uses %s references and appends their definitions to the selection', async (style, expected) => {
    expect(await convert(links, {
      'selection.markdown.linkStyle': 'referenced',
      'selection.markdown.linkReferenceStyle': style,
    })).toBe(expected);
  });

  it('defaults to full references when only referenced links are selected', async () => {
    expect(await convert(links, { 'selection.markdown.linkStyle': 'referenced' }))
      .toBe('[One][1] and [Two][2]\n\n[1]: https://example.com/one "First"\n[2]: https://example.com/two');
  });

  it('ignores the saved reference style for inline links and reuses it on the next conversion', async () => {
    await convert(links, {
      'selection.markdown.linkStyle': 'referenced',
      'selection.markdown.linkReferenceStyle': 'collapsed',
    });
    await SelectionSettings.setLinkStyle('inlined');
    expect(await convert(links, storage.data)).toBe(inline);
    expect(storage.data['selection.markdown.linkReferenceStyle']).toBe('collapsed');
    await SelectionSettings.setLinkStyle('referenced');
    expect(await convert(links, storage.data))
      .toBe('[One][] and [Two][]\n\n[One]: https://example.com/one "First"\n[Two]: https://example.com/two');
  });

  it.each([
    ['future', 'collapsed', inline],
    ['referenced', 'future', '[One][1] and [Two][2]\n\n[1]: https://example.com/one "First"\n[2]: https://example.com/two'],
  ])('validates stored %s and %s before conversion without rewriting storage', async (linkStyle, linkReferenceStyle, expected) => {
    const stored = {
      'selection.markdown.linkStyle': linkStyle,
      'selection.markdown.linkReferenceStyle': linkReferenceStyle,
    };
    const before = { ...stored };
    expect(await convert(links, stored)).toBe(expected);
    expect(storage.data).toEqual(before);
  });

  it('starts reference numbering afresh for each converted selection', async () => {
    const stored = { 'selection.markdown.linkStyle': 'referenced' };
    await convert(links, stored);
    expect(await convert('<p><a href="https://example.com/next">Next</a></p>', stored))
      .toBe('[Next][1]\n\n[1]: https://example.com/next');
  });
});

describe('combined copy selection formatting', () => {
  const html = '<h1>Heading</h1>'
    + '<p><em>italic</em> and <strong>bold</strong> with <a href="https://example.com/">Example</a></p>'
    + '<ul><li>item</li></ul>'
    + '<pre><code class="language-js">const x = 1;\n</code></pre>';

  it('preserves the combined default output', async () => {
    const ticks = String.fromCharCode(96).repeat(3);
    expect(await convert(html, {})).toBe('# Heading\n\n'
      + '_italic_ and **bold** with [Example](https://example.com/)\n\n'
      + `-   item\n\n${ticks}js\nconst x = 1;\n${ticks}`);
  });

  it('applies all validated syntax choices together, with reference definitions after the code block', async () => {
    expect(await convert(html, {
      'selection.markdown.headingStyle': 'setext',
      'selection.markdown.emDelimiter': '*',
      'selection.markdown.strongDelimiter': '__',
      'selection.markdown.bulletListMarker': '+',
      'selection.markdown.codeBlockStyle': 'fenced',
      'selection.markdown.fence': '~~~',
      'selection.markdown.linkStyle': 'referenced',
      'selection.markdown.linkReferenceStyle': 'shortcut',
    })).toBe('Heading\n=======\n\n'
      + '*italic* and __bold__ with [Example]\n\n'
      + '+   item\n\n~~~js\nconst x = 1;\n~~~\n\n'
      + '[Example]: https://example.com/');
  });

  it('combines indented code with references while ignoring the retained fence choice', async () => {
    expect(await convert(html, {
      'selection.markdown.headingStyle': 'setext',
      'selection.markdown.emDelimiter': '*',
      'selection.markdown.strongDelimiter': '__',
      'selection.markdown.bulletListMarker': '+',
      'selection.markdown.codeBlockStyle': 'indented',
      'selection.markdown.fence': '~~~',
      'selection.markdown.linkStyle': 'referenced',
      'selection.markdown.linkReferenceStyle': 'collapsed',
    })).toBe('Heading\n=======\n\n'
      + '*italic* and __bold__ with [Example][]\n\n'
      + '+   item\n\n    const x = 1;\n    \n\n'
      + '[Example]: https://example.com/');
    expect(storage.data['selection.markdown.fence']).toBe('~~~');
  });
});
