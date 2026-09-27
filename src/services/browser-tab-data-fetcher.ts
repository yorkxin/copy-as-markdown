import type { ExportScope, TabDataFetcher } from './tab-export-service.js';

import type { PermissionsAPI, RuntimeAPI, TabGroupsAPI, TabsAPI, WindowsAPI } from './shared-types.js';

interface TabDataFetcherDeps {
  permissions: PermissionsAPI;
  tabs: TabsAPI;
  windows: WindowsAPI;
  runtime: RuntimeAPI;
  tabGroups: () => TabGroupsAPI | undefined;
}

export class BrowserTabDataFetcher implements TabDataFetcher {
  constructor(private deps: TabDataFetcherDeps) { }

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

  /** When tabs permission is not granted, opens the permissions page and then throws. */
  async fetchTabs(scope: ExportScope, windowId: number): Promise<chrome.tabs.Tab[]> {
    await this.ensureTabsPermission();

    return await this.deps.tabs.query({
      highlighted: scope === 'highlighted' ? true : undefined,
      windowId,
    }) as chrome.tabs.Tab[];
  }

  async fetchTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
    const tabGroupsAPI = this.deps.tabGroups();
    if (!tabGroupsAPI) {
      return [];
    }

    try {
      const granted = await this.deps.permissions.contains({ permissions: ['tabGroups'] });
      if (!granted) {
        return [];
      }
    } catch {
      // Browsers without tabGroups reject this permission query.
      return [];
    }

    try {
      return await tabGroupsAPI.query({ windowId });
    } catch {
      return [];
    }
  }
}

export function createBrowserTabDataFetcher(): BrowserTabDataFetcher {
  return new BrowserTabDataFetcher({
    permissions: browser.permissions,
    tabs: browser.tabs,
    windows: browser.windows,
    runtime: browser.runtime,
    tabGroups: () => (typeof chrome !== 'undefined' && chrome.tabGroups)
      ? chrome.tabGroups as TabGroupsAPI
      : undefined,
  });
}
