// ⚠️ SERVICE-WORKER SAFETY: this module statically imports Turndown, which touches
// the DOM at module load, so it must only run in a DOM-bearing context — the Chrome
// offscreen document (src/offscreen.ts) or the Firefox Event Page — never the Chrome
// MV3 service worker (src/background.ts).
//
// Two callers reach this module, and only one is allowed into the Chrome service
// worker's bundle:
//   - src/offscreen.ts imports it STATICALLY. That is correct: the Chrome offscreen
//     document is the Chrome conversion path, so Turndown belongs in offscreen.js.
//   - src/services/markdown-converter.ts (createEventPageMarkdownConverter) imports it
//     via a DYNAMIC import() only, so it stays OUT of background.ts's static graph.
//     On Chrome that converter is dead-code-eliminated via BUILD_TARGET and tree-shaken.
//
// Net: Turndown must be ABSENT from chrome/dist/background.js but PRESENT in
// chrome/dist/offscreen.js. That per-entry invariant is enforced by
// scripts/assert-no-turndown.js and test/build/no-turndown-in-chrome-background.test.ts.
import type { Rule, Options as TurndownOptions } from 'turndown';
import { tables } from '@truto/turndown-plugin-gfm';
import TurndownService from 'turndown';

// Turndown wraps <p> with blank lines, and inside <li> that becomes an indented
// blank line between bullet items (e.g. "- item\n    \n- item"), which breaks
// tight-list formatting for common selections like <li><p>...</p></li>.
// This rule flattens only single-paragraph list items and leaves multi-paragraph
// or nested-list items on Turndown's default loose-list behavior.
const singleParagraphInListItemRule: Rule = {
  filter(node) {
    const parent = node.parentElement;
    return (
      node.nodeName === 'P'
      && parent?.nodeName === 'LI'
      && parent.childElementCount === 1
    );
  },
  replacement(content) {
    return content;
  },
};

/**
 * Convert an HTML fragment to Markdown. Requires a DOM (Turndown parses HTML via
 * the DOM API), so this only runs in a DOM-bearing context: the offscreen document
 * (Chrome) or the Event Page (Firefox) — never the service worker.
 */
export function htmlToMarkdown(html: string, options: TurndownOptions): string {
  const turndownService = new TurndownService(options)
    .remove('script')
    .remove('style');
  turndownService.use(tables);
  turndownService.addRule('singleParagraphInListItem', singleParagraphInListItemRule);
  return turndownService.turndown(html).replace(/\n+$/, '');
}
