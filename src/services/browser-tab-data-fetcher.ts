/**
 * Browser Tab Data Fetcher
 *
 * Handles fetching tab data from browser APIs.
 * This is the browser-specific adapter for TabExportService.
 */

import type { ExportScope, TabDataFetcher } from './tab-export-service.js';

import type { PermissionsAPI, RuntimeAPI, TabGroupsAPI, TabsAPI, WindowsAPI } from './shared-types.js';

interface TabDataFetcherDeps {
  permissions: PermissionsAPI;
  tabs: TabsAPI;
  windows: WindowsAPI;
  runtime: RuntimeAPI;
  tabGroups?: TabGroupsAPI;
}

/**
 * Browser-specific implementation of TabDataFetcher.
 * Handles all browser API interactions including permissions.
 */
export class BrowserTabDataFetcher implements TabDataFetcher {
  constructor(private deps: TabDataFetcherDeps) { }

  /**
   * Ensures tabs permission is granted, shows permission dialog if not.
   */
  private async ensureTabsPermission(): Promise<void> {
    const granted = await this.deps.permissions.contains({ permissions: ['tabs'] });

    if (!granted) {
      await this.deps.windows.create({
        focused: true,
        type: 'popup',
        width: 640,
        height: 480,
        url: this.deps.runtime.getURL('/dist/static/permissions.html?permissions=tabs'),
      });
      throw new Error('Tabs permission required');
    }
  }

  /**
   * Fetches tabs from the specified window.
   */
  async fetchTabs(scope: ExportScope, windowId: number): Promise<chrome.tabs.Tab[]> {
    await this.ensureTabsPermission();

    return await this.deps.tabs.query({
      highlighted: scope === 'highlighted' ? true : undefined,
      windowId,
    }) as chrome.tabs.Tab[];
  }

  /**
   * Fetches tab groups from the specified window.
   * Returns empty array if tabGroups permission is not granted or API is unavailable.
   */
  async fetchTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
    const tabGroupsAPI = this.deps.tabGroups;
    if (!tabGroupsAPI) {
      return [];
    }

    try {
      const granted = await this.deps.permissions.contains({ permissions: ['tabGroups'] });
      if (!granted) {
        return [];
      }
    } catch {
      // tabGroups permission doesn't exist in this browser
      return [];
    }

    try {
      return await tabGroupsAPI.query({ windowId });
    } catch {
      return [];
    }
  }
}

/**
 * Default browser-backed data fetcher factory.
 */
export function createBrowserTabDataFetcher(): BrowserTabDataFetcher {
  // TODO: Review this, do we need permission checking or not?
  const tabGroupsAPI = (typeof chrome !== 'undefined' && chrome.tabGroups)
    ? chrome.tabGroups as unknown as TabGroupsAPI
    : undefined;

  return new BrowserTabDataFetcher({
    permissions: browser.permissions,
    tabs: browser.tabs,
    windows: browser.windows,
    runtime: browser.runtime,
    tabGroups: tabGroupsAPI,
  });
}
