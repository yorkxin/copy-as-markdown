// Turndown touches the DOM at module load. Chrome reaches this module statically only
// from offscreen.ts; Firefox reaches it through markdown-converter's dynamic import.
// The build assertion keeps it out of Chrome's service-worker entry.
import type { Rule, Options as TurndownOptions } from 'turndown';
import { tables } from '@truto/turndown-plugin-gfm';
import TurndownService from 'turndown';
import type { CleanupSettings } from './cleanup-settings.js';
import { cleanChatMarkdown } from './chat-cleanup.js';

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

// Gemini AI Mode renders maths as a blank placeholder <img> plus SVG glyphs and block
// <div>s, so the default conversion yields stray Unicode fragments. The original TeX is
// kept in data-xpm-latex: the copy-root holds the whole formula, or each <img> holds a
// wrapped segment when the root has none. Roots are swapped for a plain element holding
// the TeX before conversion, so Turndown's whitespace handling sees ordinary inline
// content, and the rule below emits the TeX raw instead of escaping \ and _.
const MATH_ROOT_SELECTOR = '[data-xpm-copy-root]';
const MATH_TEX_ATTR = 'data-tex';
// The GFM table plugin doubles backslashes in cells, which corrupts TeX. TeX in cells is
// emitted with these private-use placeholders and restored after conversion.
const BACKSLASH_PLACEHOLDER = '\uE000';
const PIPE_PLACEHOLDER = '\uE001';
const TABLE_CELL_SELECTOR = 'td, th';

function extractLatex(root: Element): string {
  const whole = root.getAttribute('data-xpm-latex');
  const latex = whole ?? Array.from(root.querySelectorAll('img[data-xpm-latex]'))
    .map(img => img.getAttribute('data-xpm-latex') ?? '')
    .join('');
  return latex.replace(/\\hphantom\{\}/g, '').trim();
}

function replaceMathRoots(html: string): string {
  if (!html.includes('data-xpm-copy-root')) {
    return html;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll(MATH_ROOT_SELECTOR).forEach((root) => {
    // An earlier replacement may have detached a nested root.
    if (!root.isConnected) {
      return;
    }
    const latex = extractLatex(root);
    if (latex === '') {
      return;
    }
    const inCell = root.closest(TABLE_CELL_SELECTOR) !== null;
    // Gemini tags even single in-sentence symbols as "block", so everything is emitted
    // inline to keep sentences intact.
    const replacement = doc.createElement('span');
    replacement.setAttribute(MATH_TEX_ATTR, '');
    replacement.textContent = inCell
      ? latex.replace(/\\/g, BACKSLASH_PLACEHOLDER).replace(/\|/g, PIPE_PLACEHOLDER)
      : latex;
    root.replaceWith(replacement);
  });
  return doc.body.innerHTML;
}

const mathLatexRule: Rule = {
  filter(node) {
    return node instanceof HTMLElement && node.hasAttribute(MATH_TEX_ATTR);
  },
  replacement(_content, node) {
    return `$${node.textContent ?? ''}$`;
  },
};

/**
 * Converts HTML with Turndown in a DOM-bearing context: Chrome's offscreen
 * document or Firefox's Event Page, never Chrome's service worker.
 */
export function htmlToMarkdown(
  html: string,
  options: TurndownOptions & Partial<CleanupSettings>,
): string {
  const turndownService = new TurndownService(options)
    .remove('script')
    .remove('style');
  turndownService.use(tables);
  turndownService.addRule('mathLatex', mathLatexRule);
  if (options.removeImages) {
    turndownService.addRule('removeImages', { filter: 'img', replacement: () => '' });
  }
  if (options.removeLinks) {
    // Keeps the link text and drops the URL, in place of any link style.
    turndownService.addRule('removeLinks', { filter: 'a', replacement: content => content });
  }
  turndownService.addRule('singleParagraphInListItem', singleParagraphInListItemRule);
  const markdown = turndownService.turndown(replaceMathRoots(html))
    .replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), () => '\\')
    .replace(new RegExp(PIPE_PLACEHOLDER, 'g'), () => '\\|')
    .replace(/\n+$/, '');
  return options.cleanChatExport
    ? cleanChatMarkdown(markdown).replace(/\n+$/, '')
    : markdown;
}
