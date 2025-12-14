import { ContextMenuIds } from '../contracts/commands.js';
import type CustomFormat from '../lib/custom-format.js';
import type { BuiltInStyleSettings } from '../lib/built-in-style-settings.js';
import type { ContextMenusAPI } from './shared-types.js';

interface CustomFormatsListProvider {
  list: (context: 'single-link' | 'multiple-links') => Promise<CustomFormat[]>;
}

interface BuiltInStyleSettingsProvider {
  getAll: () => Promise<BuiltInStyleSettings>;
}

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
  builtInStyleSettingsProvider: BuiltInStyleSettingsProvider,
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

    const builtInStyles = await builtInStyleSettingsProvider.getAll();
    // Fetch custom formats
    const singleLinkFormats = (await customFormatsProvider.list('single-link'))
      .filter(format => format.showInMenus);

    // Basic page and link menus
    createBasicMenus(contextMenusAPI, builtInStyles);

    // Custom format menus for single links
    createSingleLinkCustomFormatMenus(contextMenusAPI, singleLinkFormats);

    // Image and selection menus
    createImageAndSelectionMenus(contextMenusAPI);

    // Firefox-specific: Tab and bookmark menus
    await createFirefoxSpecificMenus(
      contextMenusAPI,
      customFormatsProvider,
      singleLinkFormats,
      builtInStyles,
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
function createBasicMenus(
  contextMenusAPI: ContextMenusAPI,
  builtInStyles: BuiltInStyleSettings,
): void {
  if (builtInStyles.singleLink) {
    contextMenusAPI.create({
      id: ContextMenuIds.CurrentTab,
      title: 'Copy Page Link as Markdown',
      type: 'normal',
      contexts: ['page'],
    });

    contextMenusAPI.create({
      id: ContextMenuIds.Link,
      title: 'Copy Link as Markdown',
      type: 'normal',
      contexts: ['link'],
    });
  }
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
    id: ContextMenuIds.Image,
    title: 'Copy Image as Markdown',
    type: 'normal',
    contexts: ['image'],
  });

  contextMenusAPI.create({
    id: ContextMenuIds.SelectionAsMarkdown,
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
  builtInStyles: BuiltInStyleSettings,
): Promise<void> {
  try {
    const multipleLinksFormats = (await customFormatsProvider.list('multiple-links'))
      .filter(format => format.showInMenus);

    // Update existing menus to also work on tabs
    if (builtInStyles.singleLink) {
      await contextMenusAPI.update(ContextMenuIds.CurrentTab, {
        contexts: ['page', 'tab'],
      });
    }

    for (const format of singleLinkFormats) {
      await contextMenusAPI.update(`current-tab-custom-format-${format.slot}`, {
        contexts: ['page', 'tab'],
      });
    }

    const shouldShowAnyTabSection = builtInStyles.tabLinkList
      || builtInStyles.tabTaskList
      || builtInStyles.tabTitleList
      || builtInStyles.tabUrlList
      || multipleLinksFormats.length > 0;

    if (shouldShowAnyTabSection) {
      contextMenusAPI.create({
        id: 'separator-1',
        type: 'separator',
        contexts: ['tab'],
      });
    }

    // All tabs menus
    if (shouldShowAnyTabSection) {
      createAllTabsMenus(contextMenusAPI, multipleLinksFormats, builtInStyles);
    }

    if (shouldShowAnyTabSection) {
      contextMenusAPI.create({
        id: 'separator-2',
        type: 'separator',
        contexts: ['tab'],
      });
    }

    // Selected tabs menus
    if (shouldShowAnyTabSection) {
      createSelectedTabsMenus(contextMenusAPI, multipleLinksFormats, builtInStyles);
    }

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
  builtInStyles: BuiltInStyleSettings,
): void {
  if (builtInStyles.tabLinkList) {
    contextMenusAPI.create({
      id: ContextMenuIds.AllTabsLinkAsList,
      title: 'Copy All Tabs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTaskList) {
    contextMenusAPI.create({
      id: ContextMenuIds.AllTabsLinkAsTaskList,
      title: 'Copy All Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTitleList) {
    contextMenusAPI.create({
      id: ContextMenuIds.AllTabsTitleAsList,
      title: 'Copy All Tab Titles',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabUrlList) {
    contextMenusAPI.create({
      id: ContextMenuIds.AllTabsUrlAsList,
      title: 'Copy All Tab URLs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

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
  builtInStyles: BuiltInStyleSettings,
): void {
  if (builtInStyles.tabLinkList) {
    contextMenusAPI.create({
      id: ContextMenuIds.HighlightedTabsLinkAsList,
      title: 'Copy Selected Tabs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTaskList) {
    contextMenusAPI.create({
      id: ContextMenuIds.HighlightedTabsLinkAsTaskList,
      title: 'Copy Selected Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTitleList) {
    contextMenusAPI.create({
      id: ContextMenuIds.HighlightedTabsTitleAsList,
      title: 'Copy Selected Tab Titles',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabUrlList) {
    contextMenusAPI.create({
      id: ContextMenuIds.HighlightedTabsUrlAsList,
      title: 'Copy Selected Tab URLs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

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
      id: ContextMenuIds.BookmarkLink,
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
 * const menuService = createBrowserContextMenuService(CustomFormatsStorage, BuiltInStyleSettings);
 * await menuService.createAll();
 * ```
 */
export function createBrowserContextMenuService(
  customFormatsProvider: CustomFormatsListProvider,
  builtInStyleSettingsProvider: BuiltInStyleSettingsProvider,
): ContextMenuService {
  return createContextMenuService(browser.contextMenus, customFormatsProvider, builtInStyleSettingsProvider);
}
