import type { Options as TurndownOptions } from 'turndown';
import type { tables } from '@truto/turndown-plugin-gfm';

/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in content script.
 */
export async function selectionToMarkdown(turndownJsURL: string, gfmJsURL: string, turndownOptions: TurndownOptions): Promise<Promise<string>> {
  // Load ESM in content script.
  // See https://stackoverflow.com/a/53033388
  const turndownModule = await import(turndownJsURL);
  const TurndownService = turndownModule.default;
  const gfmPluginModule = await import(gfmJsURL);
  const gfmTablePlugin = gfmPluginModule.tables as typeof tables;

  const turndownService = new TurndownService(turndownOptions)
    .remove('script')
    .remove('style');
  turndownService.use(gfmTablePlugin);
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
