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

describe('copy Selection emphasis', () => {
  it('preserves current default output', async () => {
    expect(await convert('<p><em>italic</em> and <strong>bold</strong></p>', {}))
      .toBe('_italic_ and **bold**');
  });

  it.each([
    ['_', '**'],
    ['_', '__'],
    ['*', '**'],
    ['*', '__'],
  ])('uses validated %s and %s delimiters for real HTML, including nesting', async (em, strong) => {
    const html = '<p><em>italic</em> and <strong>bold</strong></p>'
      + '<p><em>outer <strong>inner</strong></em></p>'
      + '<p><strong>outer <em>inner</em></strong></p>';
    expect(await convert(html, {
      'selection.markdown.emDelimiter': em,
      'selection.markdown.strongDelimiter': strong,
    })).toBe(`${em}italic${em} and ${strong}bold${strong}\n\n`
      + `${em}outer ${strong}inner${strong}${em}\n\n`
      + `${strong}outer ${em}inner${em}${strong}`);
  });

  it('applies per-field fallback before passing options to Turndown', async () => {
    expect(await convert('<em>italic</em> <strong>bold</strong>', {
      'selection.markdown.emDelimiter': 'future',
      'selection.markdown.strongDelimiter': '__',
    })).toBe('_italic_ __bold__');
  });
});
