import { describe, expect, it } from 'vitest';
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';
import { htmlToMarkdown } from '../../src/lib/html-to-markdown.js';

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
    document.body.innerHTML = '<button id="anchor">x</button><h1 id="h">Hello</h1>';
    try {
      // Focus a real, focusable element so the document is activated and
      // document.hasFocus() reports true (required in headless Chromium, where an
      // un-activated document reports false). The active element is a <button> — not a
      // sub-frame — so this document qualifies as the focused leaf frame. The button is
      // not part of the selection, so it does not appear in the output.
      (document.querySelector('#anchor') as HTMLButtonElement).focus();
      selectNode('#h');
      const md = htmlToMarkdown(extractSelectionHtml(true), OPTS);
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
      const md = htmlToMarkdown(extractSelectionHtml(true), OPTS);
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
      const md = htmlToMarkdown(extractSelectionHtml(false), OPTS);
      expect(md).toBe('# Hello');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });
});
