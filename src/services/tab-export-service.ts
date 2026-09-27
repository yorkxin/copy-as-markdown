import type Markdown from '../lib/markdown.js';
import type { NestedArray } from '../lib/markdown.js';
import type { TabList } from '../lib/tabs.js';
import { Tab, TabGroup, TabListGrouper } from '../lib/tabs.js';
import CustomFormatClass from '../lib/custom-format.js';
import type { CustomFormatsProvider, MarkdownFormatter } from './shared-types.js';
import { createBrowserTabDataFetcher } from './browser-tab-data-fetcher.js';

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

export function convertBrowserTabGroups(groups: chrome.tabGroups.TabGroup[]): TabGroup[] {
  return groups.map((group: chrome.tabGroups.TabGroup) =>
    new TabGroup(group.title || '', group.id, group.color || ''),
  );
}

export function groupTabsIntoLists(tabs: Tab[], groups: TabGroup[]): TabList[] {
  return new TabListGrouper(groups).collectTabsByGroup(tabs);
}

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
 * Groups become a name followed by nested tabs; ungrouped tabs stay flat,
 * producing the shape the built-in list renderers use for an indented sub-list.
 * @example ['loose tab', 'Group A', ['tab a1', 'tab a2']]
 */
export function formatTabListsToNestedArray(
  tabLists: TabList[],
  formatter: (tab: Tab) => string,
): NestedArray {
  const items: NestedArray = [];

  for (const tabList of tabLists) {
    if (tabList.groupId === TabGroup.NonGroupId) {
      for (const tab of tabList.tabs) {
        items.push(formatter(tab));
      }
    } else {
      items.push(tabList.name);
      items.push(tabList.tabs.map(formatter));
    }
  }

  return items;
}

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

export async function renderCustomFormat(
  tabLists: TabList[],
  slot: string,
  customFormatsProvider: CustomFormatsProvider,
): Promise<string> {
  const customFormat = await customFormatsProvider.get('multiple-links', slot);
  const input = CustomFormatClass.makeRenderInputForTabLists(tabLists);
  return customFormat.render(input);
}

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

export interface TabDataFetcher {
  fetchTabs: (scope: ExportScope, windowId: number) => Promise<chrome.tabs.Tab[]>;

  /** Returns [] when tab groups are unavailable. */
  fetchTabGroups: (windowId: number) => Promise<chrome.tabGroups.TabGroup[]>;
}

export class TabExportService {
  constructor(
    private markdown: Markdown,
    private customFormatsProvider: CustomFormatsProvider,
    private tabDataFetcher: TabDataFetcher,
  ) { }

  /**
   * Exports tabs using either a built-in list format or a custom format.
   *
   * @throws {TypeError} When custom-format has no slot or also specifies listType.
   */
  async exportTabs(options: ExportTabsOptions): Promise<string> {
    validateOptions(options);

    const browserTabs = await this.tabDataFetcher.fetchTabs(options.scope, options.windowId);
    const browserGroups = await this.tabDataFetcher.fetchTabGroups(options.windowId);

    const tabs = convertBrowserTabsToTabs(
      browserTabs,
      text => this.markdown.escapeLinkText(text),
    );
    const groups = convertBrowserTabGroups(browserGroups);
    const tabLists = groupTabsIntoLists(tabs, groups);

    return renderTabs(tabLists, options, this.markdown, this.customFormatsProvider);
  }
}

export function createBrowserTabExportService(
  markdown: Markdown,
  customFormatsProvider: CustomFormatsProvider,
): TabExportService {
  return new TabExportService(
    markdown,
    customFormatsProvider,
    createBrowserTabDataFetcher(),
  );
}
