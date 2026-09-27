// Turndown touches the DOM at module load. Chrome reaches this module statically only
// from offscreen.ts; Firefox reaches it through markdown-converter's dynamic import.
// The build assertion keeps it out of Chrome's service-worker entry.
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
 * Converts HTML with Turndown in a DOM-bearing context: Chrome's offscreen
 * document or Firefox's Event Page, never Chrome's service worker.
 */
export function htmlToMarkdown(html: string, options: TurndownOptions): string {
  const turndownService = new TurndownService(options)
    .remove('script')
    .remove('style');
  turndownService.use(tables);
  turndownService.addRule('singleParagraphInListItem', singleParagraphInListItemRule);
  return turndownService.turndown(html).replace(/\n+$/, '');
}
