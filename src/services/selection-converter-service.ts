/**
 * Selection Converter Service
 *
 * Handles converting HTML selections in browser tabs to Markdown format.
 * Uses the Turndown library to perform HTML-to-Markdown conversion.
 */

import type { Options as TurndownOptions } from 'turndown';

export interface ScriptingAPI {
  executeScript: <T extends any[]>(options: {
    target: { tabId: number; allFrames?: boolean };
    func?: (...args: T) => any;
    files?: string[];
    args?: T;
  }) => Promise<Array<{ result?: any }>>;
}

export interface TurndownOptionsProvider {
  getTurndownOptions: () => TurndownOptions;
}

export interface SelectionConverterService {
  /**
   * Convert the current selection in a tab to Markdown.
   *
   * @param tab - The browser tab containing the selection
   * @returns The selection converted to Markdown, with multiple frames joined by double newlines
   */
  convertSelectionToMarkdown: (tab: browser.tabs.Tab) => Promise<string>;
}

/**
 * This function executes in the content script context.
 * It must be self-contained - no external function calls.
 *
 * NOTE: This function should be executed in content script.
 */
function selectionToMarkdown(turndownOptions: TurndownOptions): string {
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

export function createSelectionConverterService(
  scriptingAPI: ScriptingAPI,
  turndownOptionsProvider: TurndownOptionsProvider,
  turndownJsUrl: string,
): SelectionConverterService {
  async function convertSelectionToMarkdown(tab: browser.tabs.Tab): Promise<string> {
    if (!tab.id) {
      throw new Error('tab has no id');
    }

    // Load Turndown library in the content script
    await scriptingAPI.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: [turndownJsUrl],
    });

    // Execute the conversion function in all frames
    const results = await scriptingAPI.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: selectionToMarkdown,
      args: [turndownOptionsProvider.getTurndownOptions()],
    });

    // Join results from all frames with double newlines
    return results.map(frame => frame.result as string).join('\n\n');
  }

  return {
    convertSelectionToMarkdown,
  };
}

export function createBrowserSelectionConverterService(
  turndownOptionsProvider: TurndownOptionsProvider,
  turndownJsUrl: string,
): SelectionConverterService {
  return createSelectionConverterService(
    browser.scripting,
    turndownOptionsProvider,
    turndownJsUrl,
  );
}
