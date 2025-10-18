import copy from '../content-script.js';

export interface ScriptingAPI {
  executeScript: <T extends any[]>(options: {
    target: { tabId: number };
    func: (...args: T) => any;
    args: T;
  }) => Promise<Array<{ result?: any }>>;
}

export interface TabsAPI {
  query: (queryInfo: { currentWindow: true; active: true }) => Promise<browser.tabs.Tab[]>;
}

export interface ClipboardAPI {
  writeText: (text: string) => Promise<void>;
}

export interface ClipboardService {
  /**
   * Copy text to clipboard.
   * If tab is not provided, will attempt to get the current active tab.
   */
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<void>;
}

export function createClipboardService(
  scriptingAPI: ScriptingAPI,
  tabsAPI: TabsAPI,
  clipboardAPI: ClipboardAPI | null,
  iframeUrl: string,
): ClipboardService {
  async function mustGetCurrentTab(): Promise<browser.tabs.Tab> {
    const tabs = await tabsAPI.query({
      currentWindow: true,
      active: true,
    });
    if (tabs.length !== 1) {
      throw new Error('failed to get current tab');
    }
    return tabs[0]!;
  }

  async function copyUsingContentScript(tab: browser.tabs.Tab, text: string): Promise<void> {
    if (!tab.id) {
      throw new Error('tab has no id');
    }
    const results = await scriptingAPI.executeScript({
      target: {
        tabId: tab.id,
      },
      func: copy,
      args: [text, iframeUrl],
    });

    const firstResult = results[0];
    if (!firstResult) {
      throw new Error('no result from content script');
    }
    const { result } = firstResult;
    if (result.ok) {
      return;
    }
    throw new Error(`content script failed: ${result.error} (method = ${result.method})`);
  }

  async function copy_(text: string, tab?: browser.tabs.Tab): Promise<void> {
    // If clipboardAPI is provided, use it directly (for ALWAYS_USE_NAVIGATOR_COPY_API mode)
    if (clipboardAPI) {
      await clipboardAPI.writeText(text);
      return;
    }

    // Otherwise use content script approach
    // If no tab provided, get the current active tab
    let targetTab = tab;
    if (!targetTab) {
      targetTab = await mustGetCurrentTab();
    }

    await copyUsingContentScript(targetTab, text);
  }

  return {
    copy: copy_,
  };
}

export function createBrowserClipboardService(
  clipboardAPI: ClipboardAPI | null,
  iframeUrl: string,
): ClipboardService {
  return createClipboardService(
    browser.scripting,
    browser.tabs,
    clipboardAPI,
    iframeUrl,
  );
}
