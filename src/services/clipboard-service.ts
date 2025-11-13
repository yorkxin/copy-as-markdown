import copy from '../content-script.js';
import type { ScriptingAPI } from './shared-types.js';

export interface TabsAPI {
  query: (queryInfo: { currentWindow: true; active: true }) => Promise<browser.tabs.Tab[]>;
}

export interface ClipboardAPI {
  writeText: (text: string) => Promise<void>;
}

export interface ClipboardMockCall {
  text: string;
  tab?: browser.tabs.Tab;
  timestamp: number;
}

export interface ClipboardService {
  /**
   * Copy text to clipboard.
   * If tab is not provided, will attempt to get the current active tab.
   */
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<void>;

  /**
   * Get all recorded clipboard copy calls (only available in mock mode)
   */
  getCalls?: () => Promise<ClipboardMockCall[]>;

  /**
   * Reset the mock (clear all recorded calls) (only available in mock mode)
   */
  reset?: () => Promise<void>;

  /**
   * Get the most recent call (only available in mock mode)
   */
  getLastCall?: () => Promise<ClipboardMockCall | undefined>;
}

/**
 * Create a mock clipboard service for testing
 * Records all copy calls instead of writing to clipboard
 * Uses chrome.storage.session to persist data across service worker restarts
 */
export function createMockClipboardService(): ClipboardService {
  const STORAGE_KEY = 'mockClipboardCalls';

  // Helper to get calls from storage
  async function getCallsFromStorage(): Promise<ClipboardMockCall[]> {
    try {
      // Try session storage first (MV3, cleared when browser closes)
      if (browser.storage?.session) {
        const result = await browser.storage.session.get(STORAGE_KEY);
        return result[STORAGE_KEY] || [];
      }
      // Fallback to local storage
      const result = await browser.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    } catch {
      return [];
    }
  }

  // Helper to save calls to storage
  async function saveCallsToStorage(calls: ClipboardMockCall[]): Promise<void> {
    try {
      if (browser.storage?.session) {
        await browser.storage.session.set({ [STORAGE_KEY]: calls });
      } else {
        await browser.storage.local.set({ [STORAGE_KEY]: calls });
      }
    } catch (error) {
      console.error('Failed to save mock clipboard calls:', error);
    }
  }

  return {
    copy: async (text: string, tab?: browser.tabs.Tab): Promise<void> => {
      const calls = await getCallsFromStorage();
      calls.push({
        text,
        tab,
        timestamp: Date.now(),
      });
      await saveCallsToStorage(calls);
    },
    getCalls: async () => {
      return await getCallsFromStorage();
    },
    reset: async () => {
      await saveCallsToStorage([]);
    },
    getLastCall: async () => {
      const calls = await getCallsFromStorage();
      return calls[calls.length - 1];
    },
  };
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
  mockMode = false,
): ClipboardService {
  if (mockMode) {
    return createMockClipboardService();
  }

  return createClipboardService(
    browser.scripting,
    browser.tabs,
    clipboardAPI,
    iframeUrl,
  );
}
