import { describe, expect, it } from 'vitest';
import {
  convertBrowserTabGroups,
  convertBrowserTabsToTabs,
  formatTabListsToNestedArray,
  getFormatter,
  groupTabsIntoLists,
  renderBuiltInFormat,
  validateOptions,
} from '../../src/services/tab-export-service.js';
import { Tab, TabGroup, TabList } from '../../src/lib/tabs.js';
import type { MarkdownFormatter } from '../../src/services/shared-types.js';

// Simple mock markdown formatter for tests
const mockMarkdown: MarkdownFormatter = {
  escapeLinkText: (text: string) => text,
  linkTo: (title: string, url: string) => `[${title}](${url})`,
  list: (items: any[]) => {
    const flatten = (arr: any[], depth = 0): string => {
      return arr.map((item) => {
        if (Array.isArray(item)) {
          return flatten(item, depth + 1);
        }
        const indent = '  '.repeat(depth);
        return `${indent}- ${item}\n`;
      }).join('');
    };
    return flatten(items);
  },
  taskList: (items: any[]) => {
    const flatten = (arr: any[], depth = 0): string => {
      return arr.map((item) => {
        if (Array.isArray(item)) {
          return flatten(item, depth + 1);
        }
        const indent = '  '.repeat(depth);
        return `${indent}- [ ] ${item}\n`;
      }).join('');
    };
    return flatten(items);
  },
};

describe('tab Export Service - Refactored (Pure Functions)', () => {
  describe('validateOptions', () => {
    it('should pass validation for valid link format options', () => {
      expect(() => validateOptions({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 1,
      })).not.toThrow();
    });

    it('should throw if custom format is missing customFormatSlot', () => {
      expect(() => validateOptions({
        scope: 'all',
        format: 'custom-format',
        windowId: 1,
      })).toThrow(/customFormatSlot is required/);
    });

    it('should throw if custom format has listType', () => {
      expect(() => validateOptions({
        scope: 'all',
        format: 'custom-format',
        customFormatSlot: '1',
        listType: 'list',
        windowId: 1,
      })).toThrow(/listType is not allowed/);
    });
  });

  describe('convertBrowserTabsToTabs', () => {
    it('should convert browser tabs to Tab objects', () => {
      const browserTabs = [
        { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        { title: 'Twitter', url: 'https://twitter.com', groupId: 1 },
      ] as chrome.tabs.Tab[];

      const tabs = convertBrowserTabsToTabs(browserTabs, text => text);

      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toBeInstanceOf(Tab);
      expect(tabs[0]?.title).toBe('GitHub');
      expect(tabs[0]?.url).toBe('https://github.com');
      expect(tabs[0]?.groupId).toBe(-1);
      expect(tabs[1]?.groupId).toBe(1);
    });

    it('should handle missing title and url gracefully', () => {
      const browserTabs = [
        { title: undefined, url: undefined, groupId: -1 },
      ] as chrome.tabs.Tab[];

      const tabs = convertBrowserTabsToTabs(browserTabs, text => text);

      expect(tabs[0]?.title).toBe('');
      expect(tabs[0]?.url).toBe('');
    });

    it('should escape link text using provided function', () => {
      const browserTabs = [
        { title: '[Special]', url: 'https://example.com', groupId: -1 },
      ] as chrome.tabs.Tab[];

      const tabs = convertBrowserTabsToTabs(
        browserTabs,
        text => text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]'),
      );

      expect(tabs[0]?.title).toBe('\\[Special\\]');
    });
  });

  describe('convertBrowserTabGroups', () => {
    it('should convert browser tab groups to TabGroup objects', () => {
      const browserGroups = [
        { id: 1, title: 'Work', color: 'blue' },
        { id: 2, title: 'Personal', color: 'red' },
      ] as chrome.tabGroups.TabGroup[];

      const groups = convertBrowserTabGroups(browserGroups);

      expect(groups).toHaveLength(2);
      expect(groups[0]).toBeInstanceOf(TabGroup);
      expect(groups[0]?.title).toBe('Work');
      expect(groups[0]?.id).toBe(1);
      expect(groups[0]?.color).toBe('blue');
    });

    it('should handle missing title', () => {
      const browserGroups = [
        { id: 1, title: undefined, color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[];

      const groups = convertBrowserTabGroups(browserGroups);

      expect(groups[0]?.title).toBe('');
    });
  });

  describe('groupTabsIntoLists', () => {
    it('should group tabs by their group ID', () => {
      const tabs = [
        new Tab('Gmail', 'https://mail.google.com', 1),
        new Tab('Calendar', 'https://calendar.google.com', 1),
        new Tab('GitHub', 'https://github.com', -1),
      ];

      const groups = [
        new TabGroup('Work', 1, 'blue'),
      ];

      const tabLists = groupTabsIntoLists(tabs, groups);

      expect(tabLists).toHaveLength(2);
      expect(tabLists[0]?.name).toBe('Work');
      expect(tabLists[0]?.tabs).toHaveLength(2);
      expect(tabLists[1]?.groupId).toBe(TabGroup.NonGroupId);
      expect(tabLists[1]?.tabs).toHaveLength(1);
    });

    it('should handle tabs without groups', () => {
      const tabs = [
        new Tab('GitHub', 'https://github.com', -1),
        new Tab('Twitter', 'https://twitter.com', -1),
      ];

      const tabLists = groupTabsIntoLists(tabs, []);

      expect(tabLists).toHaveLength(1);
      expect(tabLists[0]?.groupId).toBe(TabGroup.NonGroupId);
      expect(tabLists[0]?.tabs).toHaveLength(2);
    });
  });

  describe('getFormatter', () => {
    it('should return link formatter for link format', () => {
      const formatter = getFormatter('link', mockMarkdown);
      const tab = new Tab('GitHub', 'https://github.com', -1);

      expect(formatter(tab)).toBe('[GitHub](https://github.com)');
    });

    it('should return title formatter for title format', () => {
      const formatter = getFormatter('title', mockMarkdown);
      const tab = new Tab('GitHub', 'https://github.com', -1);

      expect(formatter(tab)).toBe('GitHub');
    });

    it('should return url formatter for url format', () => {
      const formatter = getFormatter('url', mockMarkdown);
      const tab = new Tab('GitHub', 'https://github.com', -1);

      expect(formatter(tab)).toBe('https://github.com');
    });

    it('should throw for unknown format', () => {
      expect(() => getFormatter('invalid' as any, mockMarkdown)).toThrow(/Unknown format/);
    });
  });

  describe('formatTabListsToNestedArray', () => {
    it('should format ungrouped tabs as flat array', () => {
      const tabLists = [
        TabList.nonGroup([
          new Tab('GitHub', 'https://github.com', -1),
          new Tab('Twitter', 'https://twitter.com', -1),
        ]),
      ];

      const formatter = (tab: Tab) => tab.title;
      const result = formatTabListsToNestedArray(tabLists, formatter);

      expect(result).toEqual(['GitHub', 'Twitter']);
    });

    it('should format grouped tabs as nested array', () => {
      const tabLists = [
        new TabList('Work', 1, [
          new Tab('Gmail', 'https://mail.google.com', 1),
          new Tab('Calendar', 'https://calendar.google.com', 1),
        ]),
      ];

      const formatter = (tab: Tab) => tab.title;
      const result = formatTabListsToNestedArray(tabLists, formatter);

      expect(result).toEqual([
        'Work',
        ['Gmail', 'Calendar'],
      ]);
    });

    it('should handle mixed grouped and ungrouped tabs', () => {
      const tabLists = [
        new TabList('Work', 1, [
          new Tab('Gmail', 'https://mail.google.com', 1),
        ]),
        TabList.nonGroup([
          new Tab('GitHub', 'https://github.com', -1),
        ]),
      ];

      const formatter = (tab: Tab) => tab.title;
      const result = formatTabListsToNestedArray(tabLists, formatter);

      expect(result).toEqual([
        'Work',
        ['Gmail'],
        'GitHub',
      ]);
    });
  });

  describe('renderBuiltInFormat', () => {
    it('should render tabs as markdown link list', () => {
      const tabLists = [
        TabList.nonGroup([
          new Tab('GitHub', 'https://github.com', -1),
          new Tab('Twitter', 'https://twitter.com', -1),
        ]),
      ];

      const result = renderBuiltInFormat(tabLists, 'link', 'list', mockMarkdown);

      expect(result).toContain('[GitHub](https://github.com)');
      expect(result).toContain('[Twitter](https://twitter.com)');
      expect(result).toMatch(/^- /m); // starts with list marker
    });

    it('should render tabs as task list when listType is task-list', () => {
      const tabLists = [
        TabList.nonGroup([
          new Tab('GitHub', 'https://github.com', -1),
        ]),
      ];

      const result = renderBuiltInFormat(tabLists, 'link', 'task-list', mockMarkdown);

      expect(result).toContain('- [ ] [GitHub](https://github.com)');
    });

    it('should render tabs with title format', () => {
      const tabLists = [
        TabList.nonGroup([
          new Tab('GitHub', 'https://github.com', -1),
        ]),
      ];

      const result = renderBuiltInFormat(tabLists, 'title', 'list', mockMarkdown);

      expect(result).toContain('GitHub');
      expect(result).not.toContain('https://');
    });

    it('should render grouped tabs with nested lists', () => {
      const tabLists = [
        new TabList('Work', 1, [
          new Tab('Gmail', 'https://mail.google.com', 1),
          new Tab('Calendar', 'https://calendar.google.com', 1),
        ]),
      ];

      const result = renderBuiltInFormat(tabLists, 'title', 'list', mockMarkdown);

      expect(result).toContain('Work');
      expect(result).toContain('Gmail');
      expect(result).toContain('Calendar');
      // Check for indentation (nested list)
      expect(result).toMatch(/ {2}- Gmail/);
    });
  });
});
