/**
 * Selection Converter Service
 *
 * Handles converting HTML selections in browser tabs to Markdown format.
 * Uses the Turndown library to perform HTML-to-Markdown conversion.
 */

import type { Options as TurndownOptions } from 'turndown';
import type { ScriptingAPI } from './shared-types.js';
import { selectionToMarkdown } from '../content-scripts/selection-to-markdown.js';

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
