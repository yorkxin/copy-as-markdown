import type { Options as TurndownOptions } from 'turndown';
import type { ScriptingAPI } from './shared-types.js';
import type { MarkdownConverter } from './markdown-converter.js';
import { extractSelectionHtml } from '../content-scripts/extract-selection-html.js';

export interface TurndownOptionsProvider {
  getTurndownOptions: () => TurndownOptions;
}

export interface SelectionConverterService {
  /**
   * A provided frameId targets only that frame. Without one, every frame runs
   * the extractor and only the focused leaf contributes HTML.
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

    // frameId 0 is valid, so only undefined selects the all-frames path.
    const onlyIfFocused = frameId === undefined;
    const target = onlyIfFocused
      ? { tabId: tab.id, allFrames: true }
      : { tabId: tab.id, frameIds: [frameId] };

    // Extraction needs the page's live Selection and base URL; conversion runs out of page.
    const results = await scriptingAPI.executeScript({
      target,
      func: extractSelectionHtml,
      args: [onlyIfFocused],
    });

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
