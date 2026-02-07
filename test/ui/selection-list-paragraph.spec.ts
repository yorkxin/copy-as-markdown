import { describe, expect, it } from 'vitest';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

async function convertSelectionToMarkdown(html: string): Promise<string> {
  document.body.innerHTML = html;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(document.body);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    return await selectionToMarkdown(
      '/src/vendor/turndown.mjs',
      '/src/vendor/turndown-plugin-gfm.mjs',
      {
        headingStyle: 'atx',
        bulletListMarker: '-',
      },
    );
  } finally {
    selection?.removeAllRanges();
    document.body.innerHTML = '';
  }
}

describe('selectionToMarkdown list-item paragraph handling', () => {
  it('fixes fixture: no indented blank lines between bullet items', async () => {
    const html = await fetch('/test/fixtures/chatgpt-list.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe(
      '-   **For coding** → _IBM Plex Mono_\n'
      + '-   **For documents / retro feel** → _Courier / CMU Typewriter_\n'
      + '-   **For LaTeX / academic writing** → _CMU Typewriter Text_\n'
      + '-   **For design experiments** → _American Typewriter (mono cuts)_',
    );
    expect(md).not.toContain('\n    \n-');
  });

  it('keeps loose list formatting for multi-paragraph list items', async () => {
    const html = '<ul><li><p>a</p><p>b</p></li></ul>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('-   a\n    \n    b');
  });

  it('keeps spacing before nested list when paragraph is not only child', async () => {
    const html = '<ul><li><p>a</p><ul><li>b</li></ul></li></ul>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('-   a\n    \n    -   b');
  });

  it('does not affect list items without p wrappers', async () => {
    const html = '<ul><li>a</li><li><strong>b</strong></li></ul>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('-   a\n-   **b**');
  });

  it('applies to ordered list items', async () => {
    const html = '<ol><li><p>one</p></li><li><p>two</p></li></ol>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('1.  one\n2.  two');
  });

  it('does not affect paragraphs outside list items', async () => {
    const html = '<p>outside</p><ul><li><p>inside</p></li></ul>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('outside\n\n-   inside');
  });

  it('handles empty paragraph list items without breaking following items', async () => {
    const html = '<ul><li><p></p></li><li><p>x</p></li></ul>';
    const md = await convertSelectionToMarkdown(html);

    expect(md).toBe('-   x');
  });
});
