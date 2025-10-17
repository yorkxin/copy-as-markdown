/**
 * Tab Export Service
 *
 * Handles exporting browser tabs as Markdown.
 * Supports different formats (link, title, URL), list types (list, task list),
 * and custom format templates.
 */

import type Markdown from '../lib/markdown.js';
import type { NestedArray } from '../lib/markdown.js';
import type { TabList } from '../lib/tabs.js';
import { Tab, TabGroup, TabListGrouper } from '../lib/tabs.js';
import type CustomFormat from '../lib/custom-format.js';
import CustomFormatClass from '../lib/custom-format.js';

// Type Definitions
export type ExportFormat = 'link' | 'title' | 'url' | 'custom-format';
export type ListType = 'list' | 'task-list';
export type ExportScope = 'all' | 'highlighted';

export interface ExportTabsOptions {
  scope: ExportScope;
  format: ExportFormat;
  customFormatSlot?: string;
  listType?: ListType;
  windowId: number;
}

export interface TabsAPI {
  query: (queryInfo: browser.tabs._QueryQueryInfo) => Promise<browser.tabs.Tab[]>;
}

export interface PermissionsAPI {
  contains: (permissions: { permissions: string[] }) => Promise<boolean>;
}

export interface WindowsAPI {
  create: (createData: browser.windows._CreateCreateData) => Promise<browser.windows.Window>;
}

export interface TabGroupsAPI {
  query: (queryInfo: { windowId: number }, callback: (groups: chrome.tabGroups.TabGroup[]) => void) => void;
}

export type TabGroupsAPIResolver = () => TabGroupsAPI | null;

export interface CustomFormatsProvider {
  get: (context: 'multiple-links', slot: string) => Promise<CustomFormat>;
}

/**
 * Creates a tab export service instance.
 *
 * @param tabsAPI - Browser tabs API
 * @param permissionsAPI - Browser permissions API
 * @param windowsAPI - Browser windows API
 * @param tabGroupsAPIResolver - Function that returns the tab groups API (resolved at runtime)
 * @param markdown - Markdown formatter instance
 * @param customFormatsProvider - Provider for custom format templates
 * @returns Tab export service with methods to export tabs as Markdown
 *
 * @example
 * ```typescript
 * const tabExportService = createTabExportService(
 *   browser.tabs,
 *   browser.permissions,
 *   browser.windows,
 *   () => typeof chrome !== 'undefined' ? chrome.tabGroups : null,
 *   markdownInstance,
 *   CustomFormatsStorage
 * );
 *
 * const markdown = await tabExportService.exportTabs({
 *   scope: 'all',
 *   format: 'link',
 *   listType: 'list',
 *   windowId: 1
 * });
 * ```
 */
export function createTabExportService(
  tabsAPI: TabsAPI,
  permissionsAPI: PermissionsAPI,
  windowsAPI: WindowsAPI,
  tabGroupsAPIResolver: TabGroupsAPIResolver,
  markdown: Markdown,
  customFormatsProvider: CustomFormatsProvider,
) {
  /**
   * Exports tabs as Markdown according to the specified options.
   *
   * @throws {TypeError} If format is custom-format but customFormatSlot is missing
   * @throws {TypeError} If format is custom-format but listType is provided
   * @throws {Error} If tabs permission is not granted
   */
  async function exportTabs(options: ExportTabsOptions): Promise<string> {
    validateOptions(options);

    await ensureTabsPermission();

    const tabs = await fetchTabs(options.scope, options.windowId);
    const groups = await fetchTabGroups(options.windowId);
    const tabLists = groupTabsIntoLists(tabs, groups);

    return renderTabs(tabLists, options);
  }

  /**
   * Validates export options.
   */
  function validateOptions(options: ExportTabsOptions): void {
    if (options.format === 'custom-format') {
      if (options.listType !== null && options.listType !== undefined) {
        throw new TypeError('listType is not allowed if format is custom-format');
      }
      if (!options.customFormatSlot) {
        throw new TypeError('customFormatSlot is required if format is custom-format');
      }
    }
  }

  /**
   * Ensures tabs permission is granted, shows permission dialog if not.
   */
  async function ensureTabsPermission(): Promise<void> {
    const granted = await permissionsAPI.contains({ permissions: ['tabs'] });

    if (!granted) {
      await windowsAPI.create({
        focused: true,
        type: 'popup',
        width: 640,
        height: 480,
        url: '/dist/static/permissions.html?permissions=tabs',
      });
      throw new Error('Tabs permission required');
    }
  }

  /**
   * Fetches tabs from the specified window.
   */
  async function fetchTabs(scope: ExportScope, windowId: number): Promise<Tab[]> {
    const browserTabs = await tabsAPI.query({
      highlighted: scope === 'highlighted' ? true : undefined,
      windowId,
    }) as chrome.tabs.Tab[];

    return browserTabs.map(tab => new Tab(
      markdown.escapeLinkText(tab.title || ''),
      tab.url || '',
      tab.groupId || TabGroup.NonGroupId,
    ));
  }

  /**
   * Fetches tab groups from the specified window.
   * Returns empty array if tabGroups permission is not granted or API is unavailable.
   */
  async function fetchTabGroups(windowId: number): Promise<TabGroup[]> {
    // Check if tabGroups permission is granted
    try {
      const granted = await permissionsAPI.contains({ permissions: ['tabGroups'] });
      if (!granted) {
        return [];
      }
    } catch {
      // tabGroups permission doesn't exist in this browser
      return [];
    }

    // Resolve the API at runtime (it becomes available when permission is granted)
    const tabGroupsAPI = tabGroupsAPIResolver();
    if (!tabGroupsAPI) {
      return [];
    }

    // Promisify the callback-based API
    return new Promise((resolve, reject) => {
      tabGroupsAPI.query({ windowId }, (groups: chrome.tabGroups.TabGroup[]) => {
        const chromeRuntime = typeof chrome !== 'undefined' ? chrome.runtime : null;
        if (chromeRuntime?.lastError) {
          reject(chromeRuntime.lastError);
        } else {
          const tabGroups = groups.map((group: chrome.tabGroups.TabGroup) =>
            new TabGroup(group.title || '', group.id, group.color || ''),
          );
          resolve(tabGroups);
        }
      });
    });
  }

  /**
   * Groups tabs into organized lists (by tab group if available).
   */
  function groupTabsIntoLists(tabs: Tab[], groups: TabGroup[]): TabList[] {
    return new TabListGrouper(groups).collectTabsByGroup(tabs);
  }

  /**
   * Renders tabs as Markdown according to format and list type.
   */
  async function renderTabs(tabLists: TabList[], options: ExportTabsOptions): Promise<string> {
    if (options.format === 'custom-format') {
      if (!options.customFormatSlot) {
        throw new TypeError('customFormatSlot is required for custom-format');
      }
      return renderCustomFormat(tabLists, options.customFormatSlot);
    }

    if (!options.listType) {
      throw new TypeError('listType is required for built-in formats');
    }
    return renderBuiltInFormat(tabLists, options.format, options.listType);
  }

  /**
   * Renders tabs using a custom format template.
   */
  async function renderCustomFormat(tabLists: TabList[], slot: string): Promise<string> {
    const customFormat = await customFormatsProvider.get('multiple-links', slot);
    const input = CustomFormatClass.makeRenderInputForTabLists(tabLists);
    return customFormat.render(input);
  }

  /**
   * Renders tabs using a built-in format (link, title, or URL).
   */
  function renderBuiltInFormat(
    tabLists: TabList[],
    format: 'link' | 'title' | 'url',
    listType: ListType,
  ): string {
    const formatter = getFormatter(format);
    const items = formatItems(tabLists, formatter);

    return listType === 'list'
      ? markdown.list(items)
      : markdown.taskList(items);
  }

  /**
   * Gets the appropriate formatter function for the specified format.
   */
  function getFormatter(format: 'link' | 'title' | 'url'): (tab: Tab) => string {
    switch (format) {
      case 'link':
        return tab => markdown.linkTo(tab.title, tab.url);
      case 'title':
        return tab => tab.title;
      case 'url':
        return tab => tab.url;
      default:
        throw new TypeError(`Unknown format: ${format}`);
    }
  }

  /**
   * Formats tab lists into a nested array structure suitable for Markdown rendering.
   */
  function formatItems(tabLists: TabList[], formatter: (tab: Tab) => string): NestedArray {
    const items: NestedArray = [];

    for (const tabList of tabLists) {
      if (tabList.groupId === TabGroup.NonGroupId) {
        // Ungrouped tabs - add directly to items
        for (const tab of tabList.tabs) {
          items.push(formatter(tab));
        }
      } else {
        // Grouped tabs - add group name and nested tab list
        items.push(tabList.name);
        items.push(tabList.tabs.map(formatter));
      }
    }

    return items;
  }

  return {
    exportTabs,
  };
}

export type TabExportService = ReturnType<typeof createTabExportService>;

/**
 * Creates a tab export service using the browser's native APIs.
 *
 * @param markdown - Markdown formatter instance
 * @param customFormatsProvider - Provider for custom format templates
 * @example
 * ```typescript
 * const tabExportService = createBrowserTabExportService(
 *   markdownInstance,
 *   CustomFormatsStorage
 * );
 * await tabExportService.exportTabs({...});
 * ```
 */
export function createBrowserTabExportService(
  markdown: Markdown,
  customFormatsProvider: CustomFormatsProvider,
): TabExportService {
  // Resolver function that checks for chrome.tabGroups at runtime
  // The API becomes available in both Chrome and Firefox when tabGroups permission is granted
  const tabGroupsAPIResolver: TabGroupsAPIResolver = () => {
    if (typeof chrome !== 'undefined' && chrome.tabGroups) {
      return chrome.tabGroups;
    }
    return null;
  };

  return createTabExportService(
    browser.tabs,
    browser.permissions,
    browser.windows,
    tabGroupsAPIResolver,
    markdown,
    customFormatsProvider,
  );
}
