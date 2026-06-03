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
   * @param frameId - The frame the user interacted with (from contextMenus.OnClickData).
   *   When provided, only that frame is read. When omitted (keyboard shortcut), the
   *   converter runs in all frames and keeps only the focused leaf frame's result.
   * @returns The selection converted to Markdown for the single target frame
   */
  convertSelectionToMarkdown: (tab: browser.tabs.Tab, frameId?: number) => Promise<string>;
}

export function createSelectionConverterService(
  scriptingAPI: ScriptingAPI,
  turndownOptionsProvider: TurndownOptionsProvider,
  turndownJsURL: string,
  gfmPluginURL: string,
): SelectionConverterService {
  async function convertSelectionToMarkdown(
    tab: browser.tabs.Tab,
    frameId?: number,
  ): Promise<string> {
    if (!tab.id) {
      throw new Error('tab has no id');
    }

    // Context menu gives a precise frameId (0 is the main frame). The keyboard shortcut
    // gives no frame, so we inject into all frames and let each frame self-filter via the
    // onlyIfFocused flag. NOTE: branch on `=== undefined`, not falsiness — frameId 0 is valid.
    const onlyIfFocused = frameId === undefined;
    const target = onlyIfFocused
      ? { tabId: tab.id, allFrames: true }
      : { tabId: tab.id, frameIds: [frameId] };

    // turndown.js must be loaded in the content because it parses the HTML using DOM API.
    const results = await scriptingAPI.executeScript({
      target,
      func: selectionToMarkdown,
      args: [
        turndownJsURL,
        gfmPluginURL,
        turndownOptionsProvider.getTurndownOptions(),
        onlyIfFocused,
      ],
    });

    // Exactly one frame should contribute text: either the explicitly targeted frame, or
    // (keyboard path) the single focused leaf frame. Return that one result; no joining.
    const content = results
      .map(frame => frame.result as string)
      .find(result => result !== undefined && result !== '');
    return content ?? '';
  }

  return {
    convertSelectionToMarkdown,
  };
}

export function createBrowserSelectionConverterService(
  turndownOptionsProvider: TurndownOptionsProvider,
  turndownJsURL: string,
  gfmPluginURL: string,
): SelectionConverterService {
  return createSelectionConverterService(
    browser.scripting,
    turndownOptionsProvider,
    turndownJsURL,
    gfmPluginURL,
  );
}
