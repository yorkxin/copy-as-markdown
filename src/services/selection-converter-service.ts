import type { Options as TurndownOptions } from 'turndown';
import type { ScriptingAPI } from './shared-types.js';
import type { MarkdownConverter } from './markdown-converter.js';
import { extractSelectionHtml } from '../content-scripts/selection-to-markdown.js';

export interface TurndownOptionsProvider {
  getTurndownOptions: () => TurndownOptions;
}

export interface SelectionConverterService {
  /**
   * Convert the current selection in a tab to Markdown.
   *
   * @param tab - The browser tab containing the selection
   * @param frameId - The frame the user interacted with (from contextMenus.OnClickData).
   *   When provided, only that frame is read. When omitted (keyboard shortcut), HTML is
   *   extracted from all frames and only the focused leaf frame contributes.
   * @returns The selection converted to Markdown for the single target frame
   */
  convertSelectionToMarkdown: (tab: browser.tabs.Tab, frameId?: number) => Promise<string>;
}

export function createSelectionConverterService(
  scriptingAPI: ScriptingAPI,
  turndownOptionsProvider: TurndownOptionsProvider,
  converter: MarkdownConverter,
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

    // Selection extraction must run in the page (it depends on the live Selection and
    // base URL). Conversion runs out-of-page via the injected converter.
    const results = await scriptingAPI.executeScript({
      target,
      func: extractSelectionHtml,
      args: [onlyIfFocused],
    });

    // Exactly one frame should contribute HTML: either the explicitly targeted frame, or
    // (keyboard path) the single focused leaf frame. Find that one and convert only it.
    const html = results
      .map(frame => frame.result as string)
      .find(result => result !== undefined && result !== '');

    if (!html) {
      return '';
    }

    return await converter.convert(html, turndownOptionsProvider.getTurndownOptions());
  }

  return {
    convertSelectionToMarkdown,
  };
}

export function createBrowserSelectionConverterService(
  turndownOptionsProvider: TurndownOptionsProvider,
  converter: MarkdownConverter,
): SelectionConverterService {
  return createSelectionConverterService(
    browser.scripting,
    turndownOptionsProvider,
    converter,
  );
}
