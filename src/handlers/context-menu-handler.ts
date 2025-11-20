/**
 * Service for handling context menu click events
 */

import Markdown from '../lib/markdown.js';
import type { LinkExportService } from '../services/link-export-service.js';
import type { TabExportService } from '../services/tab-export-service.js';
import type { SelectionConverterService } from '../services/selection-converter-service.js';
import { parseCustomFormatCommand, requireWindowId } from '../services/browser-utils.js';

export interface BookmarksAPI {
  getSubTree: (id: string) => Promise<browser.bookmarks.BookmarkTreeNode[]>;
}

export interface BookmarksFormatter {
  toMarkdown: (bookmark: browser.bookmarks.BookmarkTreeNode) => string;
}

export interface ContextMenuHandler {
  /**
   * Handle a context menu click event
   * @param info - The context menu click data
   * @param tab - The active tab (may be undefined for bookmarks)
   * @returns The text to copy to clipboard
   */
  handleMenuClick: (
    info: browser.contextMenus.OnClickData,
    tab?: browser.tabs.Tab,
  ) => Promise<string>;
}

// Lookup table for Firefox tab list menu items
const TAB_LIST_MENU_ITEMS: Record<string, { scope: 'all' | 'highlighted'; listType: 'list' | 'task-list' }> = {
  'all-tabs-list': { scope: 'all', listType: 'list' },
  'all-tabs-task-list': { scope: 'all', listType: 'task-list' },
  'highlighted-tabs-list': { scope: 'highlighted', listType: 'list' },
  'highlighted-tabs-task-list': { scope: 'highlighted', listType: 'task-list' },
};

export function createContextMenuHandler(
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
    selectionConverterService: SelectionConverterService;
  },
  bookmarksAPI: BookmarksAPI,
  bookmarksFormatter: BookmarksFormatter,
): ContextMenuHandler {
  async function handleMenuClick_(
    info: browser.contextMenus.OnClickData,
    tab?: browser.tabs.Tab,
  ): Promise<string> {
    const menuItemId = info.menuItemId.toString();

    // Handle special menu items
    if (menuItemId === 'current-tab') {
      if (!tab) {
        throw new Error('tab is required for current-tab menu item');
      }
      return services.linkExportService.exportLink({
        format: 'link',
        title: tab.title || '',
        url: tab.url || '',
      });
    }

    if (menuItemId === 'link') {
      // <a href="linkURL"><img src="srcURL" /></a>
      if (info.mediaType === 'image') {
        // TODO: extract image alt text
        return Markdown.linkedImage('', info.srcUrl || '', info.linkUrl || '');
      }

      // <a href="linkURL">Text</a>
      // linkText for Firefox (as of 2018/03/07)
      // selectionText for Chrome on Mac only. On Windows it does not highlight text when right-click.
      // TODO: use linkText when Chrome supports it on stable.
      const linkText = info.selectionText || info.linkText || '';
      return services.linkExportService.exportLink({
        format: 'link',
        title: linkText,
        url: info.linkUrl || '',
      });
    }

    if (menuItemId === 'image') {
      // TODO: extract image alt text
      return Markdown.imageFor('', info.srcUrl || '');
    }

    if (menuItemId === 'selection-as-markdown') {
      if (!tab) {
        throw new Error('tab is required for selection-as-markdown menu item');
      }
      return services.selectionConverterService.convertSelectionToMarkdown(tab);
    }

    // Check if menu item is in the tab list lookup table (Firefox only)
    if (menuItemId in TAB_LIST_MENU_ITEMS) {
      if (!tab) {
        throw new Error('tab is required for tab list menu item');
      }
      const windowId = requireWindowId(tab);
      const params = TAB_LIST_MENU_ITEMS[menuItemId]!;
      return services.tabExportService.exportTabs({
        scope: params.scope,
        format: 'link',
        listType: params.listType,
        windowId,
      });
    }

    // Only available on Firefox
    if (menuItemId === 'bookmark-link') {
      if (!info.bookmarkId) {
        throw new Error('bookmarkId is required for bookmark-link menu item');
      }
      const bm = await bookmarksAPI.getSubTree(info.bookmarkId);
      if (bm.length === 0) {
        throw new Error('bookmark not found');
      }
      return bookmarksFormatter.toMarkdown(bm[0]!);
    }

    // Try to parse as custom format command
    try {
      const { context, slot } = parseCustomFormatCommand(menuItemId, ['all-tabs', 'highlighted-tabs', 'current-tab', 'link'] as const);

      switch (context) {
        case 'current-tab': {
          if (!tab) {
            throw new Error('tab is required for current-tab custom format');
          }
          return services.linkExportService.exportLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: tab.title || '',
            url: tab.url || '',
          });
        }

        case 'link': {
          // linkText for Firefox (as of 2018/03/07)
          // selectionText for Chrome on Mac only. On Windows it does not highlight text when right-click.
          // TODO: use linkText when Chrome supports it on stable.
          const linkText = info.selectionText || info.linkText || '';
          return services.linkExportService.exportLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: linkText,
            url: info.linkUrl || '',
          });
        }

        case 'all-tabs': {
          if (!tab) {
            throw new Error('tab is required for all-tabs custom format');
          }
          const windowId = requireWindowId(tab);
          return services.tabExportService.exportTabs({
            scope: 'all',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });
        }

        case 'highlighted-tabs': {
          if (!tab) {
            throw new Error('tab is required for highlighted-tabs custom format');
          }
          const windowId = requireWindowId(tab);
          return services.tabExportService.exportTabs({
            scope: 'highlighted',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });
        }

        default:
          throw new TypeError(`unknown context menu custom format context: ${context}`);
      }
    } catch (error) {
      // If it's not a custom format command, throw unknown menu item error
      if (error instanceof TypeError && error.message.includes('unknown custom format command')) {
        throw new TypeError(`unknown context menu item: ${menuItemId}`);
      }
      throw error;
    }
  }

  return {
    handleMenuClick: handleMenuClick_,
  };
}

export function createBrowserContextMenuHandler(
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
    selectionConverterService: SelectionConverterService;
  },
  bookmarksFormatter: BookmarksFormatter,
): ContextMenuHandler {
  return createContextMenuHandler(
    services,
    browser.bookmarks,
    bookmarksFormatter,
  );
}
