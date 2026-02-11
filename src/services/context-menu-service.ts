import { ContextMenuIds } from '../contracts/commands.js';
import type CustomFormat from '../lib/custom-format.js';
import type { BuiltInStyleSettings } from '../lib/built-in-style-settings.js';
import type { ContextMenusAPI } from './shared-types.js';

export interface CustomFormatsListProvider {
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

    const supportTab = await checkContextMenuSupport(contextMenusAPI, 'tab');
    const supportBookmark = await checkContextMenuSupport(contextMenusAPI, 'bookmark');

    const builtInStyles = await builtInStyleSettingsProvider.getAll();
    // Fetch custom formats
    const singleLinkFormats = (await customFormatsProvider.list('single-link'))
      .filter(format => format.showInMenus);

    const multipleLinksFormats = (await customFormatsProvider.list('multiple-links'))
      .filter(format => format.showInMenus);

    let menus: browser.menus._CreateCreateProperties[] = [];
    // Basic page and link menus
    menus = menus.concat(createBasicMenus(builtInStyles));

    // Custom format menus for single links
    menus = menus.concat(createSingleLinkCustomFormatMenus(singleLinkFormats));

    // Image and selection menus
    menus = menus.concat(createImageAndSelectionMenus());

    if (supportTab) {
      // Firefox-specific: Tab menus
      menus = menus.concat(createFirefoxSpecificMenus(
        multipleLinksFormats,
        builtInStyles,
      ));

      // Update existing menus to also work on tabs on Firefox
      if (builtInStyles.singleLink) {
        menus.find(menu => menu.id === ContextMenuIds.CurrentTab)!.contexts = ['page', 'tab'];
      }

      for (const format of singleLinkFormats) {
        menus.find(menu => menu.id === `current-tab-custom-format-${format.slot}`)!.contexts = ['page', 'tab'];
      }
    }

    if (supportBookmark) {
      // Firefox-specific Bookmark menu
      menus = menus.concat(createBookmarkMenu());
    }

    menus.forEach(menu => contextMenusAPI.create(menu));
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

async function checkContextMenuSupport(contextMenusAPI: ContextMenusAPI, testContext: browser.menus.ContextType): Promise<boolean> {
  try {
    const id = `tmp-${testContext}`;
    contextMenusAPI.create({
      id,
      contexts: [
        testContext,
      ],
    });
    await contextMenusAPI.remove(id);
    return true;
  } catch {
    console.info(`Context menus with context = ${testContext} is not supported in this browser`);
    return false;
  }
}

/**
 * Creates basic context menus for page and link.
 */
function createBasicMenus(
  builtInStyles: BuiltInStyleSettings,
): browser.menus._CreateCreateProperties[] {
  if (builtInStyles.singleLink) {
    return [
      {
        id: ContextMenuIds.CurrentTab,
        title: 'Copy Page Link as Markdown',
        type: 'normal',
        contexts: ['page'],
      },

      {
        id: ContextMenuIds.Link,
        title: 'Copy Link as Markdown',
        type: 'normal',
        contexts: ['link'],
      },
    ];
  }

  return [];
}

/**
 * Creates custom format menus for single links.
 */
function createSingleLinkCustomFormatMenus(
  formats: CustomFormat[],
): browser.menus._CreateCreateProperties[] {
  return formats.map(format => [{
    id: `current-tab-custom-format-${format.slot}`,
    title: `Copy Page Link (${format.displayName})`,
    contexts: ['page'] as browser.menus.ContextType[],
  }, {
    id: `link-custom-format-${format.slot}`,
    title: `Copy Link (${format.displayName})`,
    contexts: ['link'] as browser.menus.ContextType[],
  }],
  ).flat();
}

/**
 * Creates menus for images and text selection.
 */
function createImageAndSelectionMenus(): browser.menus._CreateCreateProperties[] {
  return [{
    id: ContextMenuIds.Image,
    title: 'Copy Image as Markdown',
    type: 'normal',
    contexts: ['image'],
  }, {
    id: ContextMenuIds.SelectionAsMarkdown,
    title: 'Copy Selection as Markdown',
    type: 'normal',
    contexts: ['selection'],
  }];
}

/**
 * Creates Firefox-specific context menus (tabs and bookmarks).
 * These features are only available in Firefox.
 */
function createFirefoxSpecificMenus(
  multipleLinksFormats: CustomFormat[],
  builtInStyles: BuiltInStyleSettings,
): browser.menus._CreateCreateProperties[] {
  let menus: browser.menus._CreateCreateProperties[] = [];
  const shouldShowAnyTabSection = builtInStyles.tabLinkList
    || builtInStyles.tabTaskList
    || builtInStyles.tabTitleList
    || builtInStyles.tabUrlList
    || multipleLinksFormats.length > 0;

  if (shouldShowAnyTabSection) {
    menus = menus.concat({
      id: 'separator-1',
      type: 'separator',
      contexts: ['tab'],
    });
  }

  // All tabs menus
  if (shouldShowAnyTabSection) {
    menus = menus.concat(createAllTabsMenus(multipleLinksFormats, builtInStyles));
  }

  if (shouldShowAnyTabSection) {
    menus = menus.concat({
      id: 'separator-2',
      type: 'separator',
      contexts: ['tab'],
    });
  }

  // Selected tabs menus
  if (shouldShowAnyTabSection) {
    menus = menus.concat(createSelectedTabsMenus(multipleLinksFormats, builtInStyles));
  }

  return menus;
}

/**
 * Creates menus for copying all tabs in the current window.
 */
function createAllTabsMenus(
  multipleLinksFormats: CustomFormat[],
  builtInStyles: BuiltInStyleSettings,
): browser.menus._CreateCreateProperties[] {
  let menus: browser.menus._CreateCreateProperties[] = [];
  if (builtInStyles.tabLinkList) {
    menus = menus.concat({
      id: ContextMenuIds.AllTabsLinkAsList,
      title: 'Copy All Tabs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTaskList) {
    menus = menus.concat({
      id: ContextMenuIds.AllTabsLinkAsTaskList,
      title: 'Copy All Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTitleList) {
    menus = menus.concat({
      id: ContextMenuIds.AllTabsTitleAsList,
      title: 'Copy All Tab Titles',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabUrlList) {
    menus = menus.concat({
      id: ContextMenuIds.AllTabsUrlAsList,
      title: 'Copy All Tab URLs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  for (const format of multipleLinksFormats) {
    menus = menus.concat({
      id: `all-tabs-custom-format-${format.slot}`,
      title: `Copy All Tabs (${format.displayName})`,
      type: 'normal',
      contexts: ['tab'],
    });
  }

  return menus;
}

/**
 * Creates menus for copying selected/highlighted tabs.
 */
function createSelectedTabsMenus(
  multipleLinksFormats: CustomFormat[],
  builtInStyles: BuiltInStyleSettings,
): browser.menus._CreateCreateProperties[] {
  let menus: browser.menus._CreateCreateProperties[] = [];
  if (builtInStyles.tabLinkList) {
    menus = menus.concat({
      id: ContextMenuIds.HighlightedTabsLinkAsList,
      title: 'Copy Selected Tabs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTaskList) {
    menus = menus.concat({
      id: ContextMenuIds.HighlightedTabsLinkAsTaskList,
      title: 'Copy Selected Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabTitleList) {
    menus = menus.concat({
      id: ContextMenuIds.HighlightedTabsTitleAsList,
      title: 'Copy Selected Tab Titles',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  if (builtInStyles.tabUrlList) {
    menus = menus.concat({
      id: ContextMenuIds.HighlightedTabsUrlAsList,
      title: 'Copy Selected Tab URLs',
      type: 'normal',
      contexts: ['tab'],
    });
  }

  for (const format of multipleLinksFormats) {
    menus = menus.concat({
      id: `highlighted-tabs-custom-format-${format.slot}`,
      title: `Copy Selected Tabs (${format.displayName})`,
      type: 'normal',
      visible: format.showInMenus,
      contexts: ['tab'],
    });
  }
  return menus;
}

/**
 * Creates menu for copying bookmarks (Firefox only).
 */
function createBookmarkMenu(): browser.menus._CreateCreateProperties[] {
  try {
    return [{
      id: ContextMenuIds.BookmarkLink,
      title: 'Copy Bookmark or Folder as Markdown',
      type: 'normal',
      contexts: ['bookmark'],
    }];
  } catch {
    console.info('Bookmark context menus not supported in this browser');
    return [];
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
