import type { Options as TurndownOptions } from 'turndown';

/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in content script.
 */
export function selectionToMarkdown(turndownOptions: TurndownOptions): string {
  const TurndownService = (globalThis as any).TurndownService;
  const turndownService = new TurndownService(turndownOptions)
    .remove('script')
    .remove('style');
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
  const html = container.innerHTML;
  return turndownService.turndown(html);
}
