import type { Rule, Options as TurndownOptions } from 'turndown';
import type { tables } from '@truto/turndown-plugin-gfm';

/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in content script.
 */
export async function selectionToMarkdown(
  turndownJsURL: string,
  gfmJsURL: string,
  turndownOptions: TurndownOptions,
): Promise<Promise<string>> {
  // Load ESM in content script.
  // See https://stackoverflow.com/a/53033388
  const turndownModule = await import(turndownJsURL);
  const TurndownService = turndownModule.default;
  const gfmPluginModule = await import(gfmJsURL);
  const gfmTablePlugin = gfmPluginModule.tables as typeof tables;
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

  const turndownService = new TurndownService(turndownOptions)
    .remove('script')
    .remove('style');
  turndownService.use(gfmTablePlugin);
  turndownService.addRule(
    'singleParagraphInListItem',
    singleParagraphInListItemRule,
  );
  const sel = getSelection();
  const container = document.createElement('div');
  if (!sel) {
    return '';
  }
  for (let i = 0, len = sel.rangeCount; i < len; i += 1) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }

  // Fix <a href> so that they are absolute URLs
  container.querySelectorAll('a').forEach((value) => {
    value.setAttribute('href', value.href);
  });

  // Fix <img src> so that they are absolute URLs
  container.querySelectorAll('img').forEach((value) => {
    value.setAttribute('src', value.src);
  });

  // Normalize wrapped PRE blocks into canonical <pre><code>...</code></pre>.
  // This keeps matching conservative and delegates markdown rendering details
  // (fenced vs indented, language handling, fence sizing) to Turndown built-ins.
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.firstElementChild?.nodeName === 'CODE') {
      return;
    }

    const codeNodes = pre.querySelectorAll('code');
    if (codeNodes.length !== 1) {
      return;
    }

    const codeNode = codeNodes[0]!;
    const className = codeNode.getAttribute('class') || '';
    const hasLanguageClass = /\blanguage-\S+\b/.test(className);
    const codeText = codeNode.textContent || '';
    const hasMultilineCode = codeText.includes('\n');

    // Conservative matcher: avoid rewriting instructional <pre> content.
    if (!hasLanguageClass && !hasMultilineCode) {
      return;
    }

    const normalizedCode = document.createElement('code');
    if (className) {
      normalizedCode.setAttribute('class', className);
    }
    normalizedCode.textContent = codeText;
    pre.replaceChildren(normalizedCode);
  });
  const html = container.innerHTML;
  return turndownService.turndown(html);
}
