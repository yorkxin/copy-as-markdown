// ⚠️ SERVICE-WORKER SAFETY: this module statically imports Turndown, which touches
// the DOM at module load, so it must only run in a DOM-bearing context (the Chrome
// offscreen document or the Firefox Event Page) — never the Chrome MV3 service worker.
// Exclusion from the Chrome service-worker bundle is now enforced at COMPILE TIME:
// background.ts selects the converter via `BUILD_TARGET`, so on Chrome the Firefox
// branch (the only path that imports this module) is dead-code-eliminated and
// tree-shaken away. The invariant is verified by scripts/assert-no-turndown.js and
// test/build/no-turndown-in-chrome-background.test.ts.
import type { Rule, Options as TurndownOptions } from 'turndown';
import TurndownService from '../shims/turndown.js';
import { tables } from '../shims/turndown-plugin-gfm.js';

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
