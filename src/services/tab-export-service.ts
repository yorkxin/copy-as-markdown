/**
 * Tab Export Service
 *
 * Handles exporting browser tabs as Markdown.
 * Supports different formats (link, title, URL), list types (list, task list),
 * and custom format templates.
 *
 * Architecture:
 * - Pure functions for business logic (easy to test, no mocking needed)
 * - Service class is browser-agnostic (takes data, returns markdown)
 * - Browser integration is handled externally
 */

import type Markdown from '../lib/markdown.js';
import type { NestedArray } from '../lib/markdown.js';
import type { TabList } from '../lib/tabs.js';
import { Tab, TabGroup, TabListGrouper } from '../lib/tabs.js';
import CustomFormatClass from '../lib/custom-format.js';
import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';
import { BrowserTabDataFetcher } from './browser-tab-data-fetcher.js';

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
 */
export function convertBrowserTabGroups(groups: chrome.tabGroups.TabGroup[]): TabGroup[] {
  return groups.map((group: chrome.tabGroups.TabGroup) =>
    new TabGroup(group.title || '', group.id, group.color || ''),
  );
}

/**
 * Groups tabs into organized lists by tab group.
 */
export function groupTabsIntoLists(tabs: Tab[], groups: TabGroup[]): TabList[] {
  return new TabListGrouper(groups).collectTabsByGroup(tabs);
}

/**
 * Gets the appropriate formatter function for the specified format.
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
// SERVICE - Browser-agnostic (no browser API calls)
// ==============================================================================

/**
 * Interface for fetching tab data from browser.
 * Implement this to provide tab data to the service.
 */
export interface TabDataFetcher {
  /**
   * Fetch tabs from the specified window.
   * Should handle permissions and throw errors if needed.
   */
  fetchTabs: (scope: ExportScope, windowId: number) => Promise<chrome.tabs.Tab[]>;

  /**
   * Fetch tab groups from the specified window.
   * Should return empty array if unavailable.
   */
  fetchTabGroups: (windowId: number) => Promise<chrome.tabGroups.TabGroup[]>;
}

/**
 * Tab Export Service - browser-agnostic.
 * Takes tab data and converts it to markdown.
 */
export class TabExportService {
  constructor(
    private markdown: Markdown,
    private customFormatsProvider: CustomFormatsProvider,
    private tabDataFetcher: TabDataFetcher,
  ) { }

  /**
   * Exports tabs as Markdown according to the specified options.
   *
   * @throws {TypeError} If format is custom-format but customFormatSlot is missing
   * @throws {TypeError} If format is custom-format but listType is provided
   * @throws {Error} If tabs permission is not granted (thrown by tabDataFetcher)
   */
  async exportTabs(options: ExportTabsOptions): Promise<string> {
    // Validate (pure function)
    validateOptions(options);

    // Fetch data (delegated to injected fetcher)
    const browserTabs = await this.tabDataFetcher.fetchTabs(options.scope, options.windowId);
    const browserGroups = await this.tabDataFetcher.fetchTabGroups(options.windowId);

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
}

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
  return new TabExportService(
    markdown,
    customFormatsProvider,
    new BrowserTabDataFetcher(),
  );
}
