/**
 * Context Menu Service
 *
 * Handles browser extension context menu (right-click menu) creation and management.
 * Creates menus for copying links, images, selections, tabs, and bookmarks as Markdown.
 */

import type CustomFormat from '../lib/custom-format.js';
import type { ContextMenusAPI } from './shared-types.js';

type CustomFormatsListProvider = {
  list: (context: 'single-link' | 'multiple-links') => Promise<CustomFormat[]>;
};

/**
 * Creates a context menu service instance.
 *
 * @param contextMenusAPI - The browser context menus API
 * @param customFormatsProvider - Provider for custom format templates
 * @returns Context menu service with methods to create and refresh menus
 *
 * @example
 * ```typescript
 * const menuService = createContextMenuService(
 *   browser.contextMenus,
 *   CustomFormatsStorage
 * );
 *
 * await menuService.createAll();
 * ```
 */
export function createContextMenuService(
  contextMenusAPI: ContextMenusAPI,
  customFormatsProvider: CustomFormatsListProvider,
) {
  /**
   * Creates all context menus for the extension.
   * This includes:
   * - Page/Link menus (copy current page, copy link)
   * - Image menu (copy image as Markdown)
   * - Selection menu (copy selection as Markdown)
   * - Tab menus (Firefox only - copy all/selected tabs)
   * - Bookmark menu (Firefox only - copy bookmark/folder)
   * - Custom format menus (user-defined templates)
   */
  async function createAll(): Promise<void> {
    await contextMenusAPI.removeAll();

    // Fetch custom formats
    const singleLinkFormats = (await customFormatsProvider.list('single-link'))
      .filter(format => format.showInMenus);

    // Basic page and link menus
    createBasicMenus(contextMenusAPI);

    // Custom format menus for single links
    createSingleLinkCustomFormatMenus(contextMenusAPI, singleLinkFormats);

    // Image and selection menus
    createImageAndSelectionMenus(contextMenusAPI);

    // Firefox-specific: Tab and bookmark menus
    await createFirefoxSpecificMenus(
      contextMenusAPI,
      customFormatsProvider,
      singleLinkFormats,
    );
  }

  return {
    /**
     * Creates all context menus for the extension.
     * Removes all existing menus first to ensure clean state.
     */
    createAll,

    /**
     * Refreshes all context menus.
     * Alias for createAll() - removes and recreates all menus.
     */
    async refresh(): Promise<void> {
      await createAll();
    },
  };
}

export type ContextMenuService = ReturnType<typeof createContextMenuService>;

/**
 * Creates basic context menus for page and link.
 */
function createBasicMenus(contextMenusAPI: ContextMenusAPI): void {
  contextMenusAPI.create({
    id: 'current-tab',
    title: 'Copy Page Link as Markdown',
    type: 'normal',
    contexts: ['page'],
  });

  contextMenusAPI.create({
    id: 'link',
    title: 'Copy Link as Markdown',
    type: 'normal',
    contexts: ['link'],
  });
}

/**
 * Creates custom format menus for single links.
 */
function createSingleLinkCustomFormatMenus(
  contextMenusAPI: ContextMenusAPI,
  formats: CustomFormat[],
): void {
  for (const format of formats) {
    contextMenusAPI.create({
      id: `current-tab-custom-format-${format.slot}`,
      title: `Copy Page Link (${format.displayName})`,
      contexts: ['page'],
    });

    contextMenusAPI.create({
      id: `link-custom-format-${format.slot}`,
      title: `Copy Link (${format.displayName})`,
      contexts: ['link'],
    });
  }
}

/**
 * Creates menus for images and text selection.
 */
function createImageAndSelectionMenus(contextMenusAPI: ContextMenusAPI): void {
  contextMenusAPI.create({
    id: 'image',
    title: 'Copy Image as Markdown',
    type: 'normal',
    contexts: ['image'],
  });

  contextMenusAPI.create({
    id: 'selection-as-markdown',
    title: 'Copy Selection as Markdown',
    type: 'normal',
    contexts: ['selection'],
  });
}

/**
 * Creates Firefox-specific context menus (tabs and bookmarks).
 * These features are only available in Firefox.
 */
async function createFirefoxSpecificMenus(
  contextMenusAPI: ContextMenusAPI,
  customFormatsProvider: CustomFormatsListProvider,
  singleLinkFormats: CustomFormat[],
): Promise<void> {
  try {
    const multipleLinksFormats = (await customFormatsProvider.list('multiple-links'))
      .filter(format => format.showInMenus);

    // Update existing menus to also work on tabs
    await contextMenusAPI.update('current-tab', {
      contexts: ['page', 'tab'],
    });

    for (const format of singleLinkFormats) {
      await contextMenusAPI.update(`current-tab-custom-format-${format.slot}`, {
        contexts: ['page', 'tab'],
      });
    }

    // Separator
    contextMenusAPI.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['tab'],
    });

    // All tabs menus
    createAllTabsMenus(contextMenusAPI, multipleLinksFormats);

    // Separator
    contextMenusAPI.create({
      id: 'separator-2',
      type: 'separator',
      contexts: ['tab'],
    });

    // Selected tabs menus
    createSelectedTabsMenus(contextMenusAPI, multipleLinksFormats);

    // Bookmark menu
    createBookmarkMenu(contextMenusAPI);
  } catch {
    console.info('Firefox-specific context menus not supported in this browser');
  }
}

/**
 * Creates menus for copying all tabs in the current window.
 */
function createAllTabsMenus(
  contextMenusAPI: ContextMenusAPI,
  multipleLinksFormats: CustomFormat[],
): void {
  contextMenusAPI.create({
    id: 'all-tabs-list',
    title: 'Copy All Tabs',
    type: 'normal',
    contexts: ['tab'],
  });

  contextMenusAPI.create({
    id: 'all-tabs-task-list',
    title: 'Copy All Tabs (Task List)',
    type: 'normal',
    contexts: ['tab'],
  });

  for (const format of multipleLinksFormats) {
    contextMenusAPI.create({
      id: `all-tabs-custom-format-${format.slot}`,
      title: `Copy All Tabs (${format.displayName})`,
      type: 'normal',
      contexts: ['tab'],
    });
  }
}

/**
 * Creates menus for copying selected/highlighted tabs.
 */
function createSelectedTabsMenus(
  contextMenusAPI: ContextMenusAPI,
  multipleLinksFormats: CustomFormat[],
): void {
  contextMenusAPI.create({
    id: 'highlighted-tabs-list',
    title: 'Copy Selected Tabs',
    type: 'normal',
    contexts: ['tab'],
  });

  contextMenusAPI.create({
    id: 'highlighted-tabs-task-list',
    title: 'Copy Selected Tabs (Task List)',
    type: 'normal',
    contexts: ['tab'],
  });

  for (const format of multipleLinksFormats) {
    contextMenusAPI.create({
      id: `highlighted-tabs-custom-format-${format.slot}`,
      title: `Copy Selected Tabs (${format.displayName})`,
      type: 'normal',
      visible: format.showInMenus,
      contexts: ['tab'],
    });
  }
}

/**
 * Creates menu for copying bookmarks (Firefox only).
 */
function createBookmarkMenu(contextMenusAPI: ContextMenusAPI): void {
  try {
    contextMenusAPI.create({
      id: 'bookmark-link',
      title: 'Copy Bookmark or Folder as Markdown',
      type: 'normal',
      contexts: ['bookmark'],
    });
  } catch {
    console.info('Bookmark context menus not supported in this browser');
  }
}

/**
 * Creates a context menu service using the browser's native APIs.
 *
 * @param customFormatsProvider - Provider for custom format templates
 * @example
 * ```typescript
 * import CustomFormatsStorage from './storage/custom-formats-storage.js';
 * const menuService = createBrowserContextMenuService(CustomFormatsStorage);
 * await menuService.createAll();
 * ```
 */
export function createBrowserContextMenuService(
  customFormatsProvider: CustomFormatsListProvider,
): ContextMenuService {
  return createContextMenuService(browser.contextMenus, customFormatsProvider);
}
