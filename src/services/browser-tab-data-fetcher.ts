/**
 * Browser Tab Data Fetcher
 *
 * Handles fetching tab data from browser APIs.
 * This is the browser-specific adapter for TabExportService.
 */

import type { ExportScope, TabDataFetcher } from './tab-export-service.js';

/**
 * Browser-specific implementation of TabDataFetcher.
 * Handles all browser API interactions including permissions.
 */
export class BrowserTabDataFetcher implements TabDataFetcher {
  /**
   * Ensures tabs permission is granted, shows permission dialog if not.
   */
  private async ensureTabsPermission(): Promise<void> {
    const granted = await browser.permissions.contains({ permissions: ['tabs'] });

    if (!granted) {
      await browser.windows.create({
        focused: true,
        type: 'popup',
        width: 640,
        height: 480,
        url: browser.runtime.getURL('/dist/static/permissions.html?permissions=tabs'),
      });
      throw new Error('Tabs permission required');
    }
  }

  /**
   * Fetches tabs from the specified window.
   */
  async fetchTabs(scope: ExportScope, windowId: number): Promise<chrome.tabs.Tab[]> {
    await this.ensureTabsPermission();

    return await browser.tabs.query({
      highlighted: scope === 'highlighted' ? true : undefined,
      windowId,
    }) as chrome.tabs.Tab[];
  }

  /**
   * Fetches tab groups from the specified window.
   * Returns empty array if tabGroups permission is not granted or API is unavailable.
   */
  async fetchTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
    // Check if tabGroups permission is granted
    try {
      const granted = await browser.permissions.contains({ permissions: ['tabGroups'] });
      if (!granted) {
        return [];
      }
    } catch {
      // tabGroups permission doesn't exist in this browser
      return [];
    }

    // Check if API is available
    if (!chrome.tabGroups || typeof chrome.tabGroups.query !== 'function') {
      return [];
    }

    return await chrome.tabGroups.query({ windowId }) as chrome.tabGroups.TabGroup[];
  }
}
