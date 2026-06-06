// ⚠️ SERVICE-WORKER SAFETY: this module statically imports Turndown, which touches
// the DOM at module load. It must therefore only be loaded in a DOM-bearing context
// (the offscreen document on Chrome, the Event Page on Firefox) — NEVER in the Chrome
// MV3 service worker. Do not statically import this module from background.ts or from
// anything in background.ts's static import graph. The Firefox path loads it via a
// dynamic import() in markdown-converter.ts (createEventPageMarkdownConverter) for
// exactly this reason; keep it that way.
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
