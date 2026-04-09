import { describe, expect, it } from 'vitest';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

async function convertSelectionToMarkdown(options: {
  html: string;
  select: () => void;
}): Promise<string> {
  document.body.innerHTML = options.html;
  try {
    options.select();
    return await selectionToMarkdown(
      '/src/vendor/turndown.mjs',
      '/src/vendor/turndown-plugin-gfm.mjs',
      {
        headingStyle: 'atx',
        bulletListMarker: '-',
      },
    );
  } finally {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
  }
}

describe('selectionToMarkdown trailing newline handling', () => {
  it('trims trailing newlines after a selected heading node', async () => {
    const md = await convertSelectionToMarkdown({
      html: '<section><h1 id="heading">Astro A20 X</h1><div></div><div></div><div></div></section>',
      select: () => {
        const heading = document.querySelector('#heading');
        if (!heading) {
          throw new Error('selection target not found: #heading');
        }
        const range = document.createRange();
        range.selectNode(heading);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      },
    });

    expect(md).toBe('# Astro A20 X');
  });

  it('trims trailing newlines after a partial heading text selection', async () => {
    const md = await convertSelectionToMarkdown({
      html: '<h1 id="heading">Astro A20 X</h1>',
      select: () => {
        const heading = document.querySelector('#heading');
        const textNode = heading?.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
          throw new Error('heading text node not found');
        }
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      },
    });

    expect(md).toBe('Astro');
  });
});
