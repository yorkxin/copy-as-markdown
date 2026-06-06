import { describe, expect, it } from 'vitest';
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';

function selectNodeContents(selector: string): void {
  const node = document.querySelector(selector)!;
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('extractSelectionHtml', () => {
  it('returns the selected fragment HTML', () => {
    document.body.innerHTML = '<div id="s"><h1>Hi</h1></div>';
    try {
      selectNodeContents('#s');
      expect(extractSelectionHtml(false)).toBe('<h1>Hi</h1>');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('absolutizes relative anchor hrefs', () => {
    document.body.innerHTML = '<div id="s"><a href="/foo">x</a></div>';
    try {
      selectNodeContents('#s');
      const html = extractSelectionHtml(false);
      expect(html).toContain(`href="${location.origin}/foo"`);
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns empty string when there is no selection', () => {
    window.getSelection()?.removeAllRanges();
    expect(extractSelectionHtml(false)).toBe('');
  });

  it('returns empty string when onlyIfFocused and a sub-frame is the active element', () => {
    document.body.innerHTML = '<div id="s"><h1>Hi</h1></div><iframe id="f"></iframe>';
    try {
      selectNodeContents('#s');
      (document.querySelector('#f') as HTMLIFrameElement).focus();
      expect(extractSelectionHtml(true)).toBe('');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });

  it('returns the fragment when onlyIfFocused and this is the focused leaf', () => {
    document.body.innerHTML = '<button id="a">x</button><div id="s"><h1>Hi</h1></div>';
    try {
      (document.querySelector('#a') as HTMLButtonElement).focus();
      selectNodeContents('#s');
      expect(extractSelectionHtml(true)).toBe('<h1>Hi</h1>');
    } finally {
      window.getSelection()?.removeAllRanges();
      document.body.innerHTML = '';
    }
  });
});
