import { describe, expect, it } from 'vitest';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

const TURNDOWN = '/src/vendor/turndown.mjs';
const GFM = '/src/vendor/turndown-plugin-gfm.mjs';
const OPTS = { headingStyle: 'atx' as const, bulletListMarker: '-' as const };

function selectNode(selector: string): void {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`selection target not found: ${selector}`);
  }
  const range = document.createRange();
  range.selectNode(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('selectionToMarkdown focused-frame heuristic', () => {
  it('returns content when onlyIfFocused is true and this document is the focused leaf', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1>';
    try {
      selectNode('#h');
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, true);
      expect(md).toBe('# Hello');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns empty string when onlyIfFocused is true but a sub-frame is the active element', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1><iframe id="f"></iframe>';
    try {
      selectNode('#h');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, true);
      expect(md).toBe('');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('ignores the heuristic and returns content when onlyIfFocused is false', async () => {
    document.body.innerHTML = '<h1 id="h">Hello</h1><iframe id="f"></iframe>';
    try {
      selectNode('#h');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      const md = await selectionToMarkdown(TURNDOWN, GFM, OPTS, false);
      expect(md).toBe('# Hello');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });
});
