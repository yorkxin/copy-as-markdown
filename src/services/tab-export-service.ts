/**
 * Tab Export Service
 *
 * Handles exporting browser tabs as Markdown.
 * Supports different formats (link, title, URL), list types (list, task list),
 * and custom format templates.
 *
 * Architecture:
 * - Pure functions for business logic (easy to test, no mocking needed)
 * - Thin service class for browser API interactions
 */

import type Markdown from '../lib/markdown.js';
import type { NestedArray } from '../lib/markdown.js';
import type { TabList } from '../lib/tabs.js';
import { Tab, TabGroup, TabListGrouper } from '../lib/tabs.js';
import CustomFormatClass from '../lib/custom-format.js';
import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';

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

// ==============================================================================
// PURE FUNCTIONS - Business logic that can be tested without mocking
// ==============================================================================

/**
 * Validates export options.
 * Pure function - no dependencies, easy to test.
 */
export function validateOptions(options: ExportTabsOptions): void {
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
 * Converts browser tabs to our domain Tab model.
 * Pure function - takes data, returns data.
 */
export function convertBrowserTabsToTabs(
  browserTabs: chrome.tabs.Tab[],
  escapeLinkText: (text: string) => string,
): Tab[] {
  return browserTabs.map(tab => new Tab(
    escapeLinkText(tab.title || ''),
    tab.url || '',
    tab.groupId || TabGroup.NonGroupId,
  ));
}

/**
 * Converts browser tab groups to our domain TabGroup model.
 * Pure function - takes data, returns data.
 */
export function convertBrowserTabGroups(groups: chrome.tabGroups.TabGroup[]): TabGroup[] {
  return groups.map((group: chrome.tabGroups.TabGroup) =>
    new TabGroup(group.title || '', group.id, group.color || ''),
  );
}

/**
 * Groups tabs into organized lists by tab group.
 * Pure function - no side effects.
 */
export function groupTabsIntoLists(tabs: Tab[], groups: TabGroup[]): TabList[] {
  return new TabListGrouper(groups).collectTabsByGroup(tabs);
}

/**
 * Gets the appropriate formatter function for the specified format.
 * Pure function - returns another pure function.
 */
export function getFormatter(
  format: 'link' | 'title' | 'url',
  markdown: MarkdownFormatter,
): (tab: Tab) => string {
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
 * Formats tab lists into a nested array structure for Markdown rendering.
 * Pure function - no side effects, just data transformation.
 */
export function formatTabListsToNestedArray(
  tabLists: TabList[],
  formatter: (tab: Tab) => string,
): NestedArray {
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

/**
 * Renders tabs using a built-in format (link, title, or URL).
 * Pure function - all dependencies passed as parameters.
 */
export function renderBuiltInFormat(
  tabLists: TabList[],
  format: 'link' | 'title' | 'url',
  listType: ListType,
  markdown: MarkdownFormatter,
): string {
  const formatter = getFormatter(format, markdown);
  const items = formatTabListsToNestedArray(tabLists, formatter);

  return listType === 'list'
    ? markdown.list(items)
    : markdown.taskList(items);
}

/**
 * Renders tabs using a custom format template.
 */
export async function renderCustomFormat(
  tabLists: TabList[],
  slot: string,
  customFormatsProvider: CustomFormatsProvider,
): Promise<string> {
  const customFormat = await customFormatsProvider.get('multiple-links', slot);
  const input = CustomFormatClass.makeRenderInputForTabLists(tabLists);
  return customFormat.render(input);
}

/**
 * Main rendering orchestrator.
 * Coordinates between built-in and custom format rendering.
 */
export async function renderTabs(
  tabLists: TabList[],
  options: ExportTabsOptions,
  markdown: MarkdownFormatter,
  customFormatsProvider: CustomFormatsProvider,
): Promise<string> {
  if (options.format === 'custom-format') {
    if (!options.customFormatSlot) {
      throw new TypeError('customFormatSlot is required for custom-format');
    }
    return renderCustomFormat(tabLists, options.customFormatSlot, customFormatsProvider);
  }

  if (!options.listType) {
    throw new TypeError('listType is required for built-in formats');
  }
  return renderBuiltInFormat(tabLists, options.format, options.listType, markdown);
}

// ==============================================================================
// SERVICE - Thin wrapper around browser APIs
// ==============================================================================

/**
 * Tab Export Service - handles browser API interactions.
 * Most business logic is delegated to pure functions above.
 */
export class TabExportService {
  constructor(
    private markdown: Markdown,
    private customFormatsProvider: CustomFormatsProvider,
  ) { }

  /**
   * Exports tabs as Markdown according to the specified options.
   *
   * @throws {TypeError} If format is custom-format but customFormatSlot is missing
   * @throws {TypeError} If format is custom-format but listType is provided
   * @throws {Error} If tabs permission is not granted
   */
  async exportTabs(options: ExportTabsOptions): Promise<string> {
    // Validate (pure function)
    validateOptions(options);

    // Ensure permissions (browser API)
    await this.ensureTabsPermission();

    // Fetch data (browser API)
    const browserTabs = await this.fetchBrowserTabs(options.scope, options.windowId);
    const browserGroups = await this.fetchBrowserTabGroups(options.windowId);

    // Convert and process (pure functions)
    const tabs = convertBrowserTabsToTabs(
      browserTabs,
      text => this.markdown.escapeLinkText(text),
    );
    const groups = convertBrowserTabGroups(browserGroups);
    const tabLists = groupTabsIntoLists(tabs, groups);

    // Render (mostly pure, except custom format storage access)
    return renderTabs(tabLists, options, this.markdown, this.customFormatsProvider);
  }

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
        url: '/dist/static/permissions.html?permissions=tabs',
      });
      throw new Error('Tabs permission required');
    }
  }

  /**
   * Fetches tabs from the specified window.
   */
  private async fetchBrowserTabs(
    scope: ExportScope,
    windowId: number,
  ): Promise<chrome.tabs.Tab[]> {
    return await browser.tabs.query({
      highlighted: scope === 'highlighted' ? true : undefined,
      windowId,
    }) as chrome.tabs.Tab[];
  }

  /**
   * Fetches tab groups from the specified window.
   * Returns empty array if tabGroups permission is not granted or API is unavailable.
   */
  private async fetchBrowserTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
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
    if (typeof chrome === 'undefined' || !chrome.tabGroups) {
      return [];
    }

    // Promisify the callback-based API
    return new Promise((resolve, reject) => {
      chrome.tabGroups.query({ windowId }, (groups: chrome.tabGroups.TabGroup[]) => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(groups);
        }
      });
    });
  }
}
