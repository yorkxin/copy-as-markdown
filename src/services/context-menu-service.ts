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

export function createContextMenuService(
  contextMenusAPI: ContextMenusAPI,
  customFormatsProvider: CustomFormatsListProvider,
  builtInStyleSettingsProvider: BuiltInStyleSettingsProvider,
) {
  /**
   * Removes and rebuilds every supported built-in and custom menu.
   * Tab and bookmark menus are included only when the browser supports them.
   */
  async function createAll(): Promise<void> {
    await contextMenusAPI.removeAll();

    const supportTab = await checkContextMenuSupport(contextMenusAPI, 'tab');
    const supportBookmark = await checkContextMenuSupport(contextMenusAPI, 'bookmark');

    const builtInStyles = await builtInStyleSettingsProvider.getAll();
    const singleLinkFormats = (await customFormatsProvider.list('single-link'))
      .filter(format => format.showInMenus);

    const multipleLinksFormats = (await customFormatsProvider.list('multiple-links'))
      .filter(format => format.showInMenus);

    let menus: browser.menus._CreateCreateProperties[] = [];
    menus = menus.concat(createBasicMenus(builtInStyles));

    menus = menus.concat(createSingleLinkCustomFormatMenus(singleLinkFormats));

    menus = menus.concat(createImageAndSelectionMenus());

    if (supportTab) {
      menus = menus.concat(createFirefoxSpecificMenus(
        multipleLinksFormats,
        builtInStyles,
      ));

      // Firefox supports these page actions in the tab-strip context as well.
      if (builtInStyles.singleLink) {
        menus.find(menu => menu.id === ContextMenuIds.CurrentTab)!.contexts = ['page', 'tab'];
      }

      for (const format of singleLinkFormats) {
        menus.find(menu => menu.id === `current-tab-custom-format-${format.slot}`)!.contexts = ['page', 'tab'];
      }
    }

    if (supportBookmark) {
      menus = menus.concat(createBookmarkMenu());
    }

    // Firefox rejects a separator as the first item in a context.
    const i = menus.findIndex(menu => (menu.contexts || []).includes('tab'));
    if (i !== -1 && menus[i]!.type === 'separator') {
      menus = menus.slice(0, i).concat(menus.slice(i + 1, menus.length));
    }

    menus.forEach(menu => contextMenusAPI.create(menu));
  }

  return {
    createAll,

    async refresh(): Promise<void> {
      await createAll();
    },
  };
}

export type ContextMenuService = ReturnType<typeof createContextMenuService>;

/** Probes support with a throwaway menu because the API exposes no context capability flag. */
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
      id: 'separator-tab-1',
      type: 'separator',
      contexts: ['tab'],
    });
  }

  if (shouldShowAnyTabSection) {
    menus = menus.concat(createAllTabsMenus(multipleLinksFormats, builtInStyles));
  }

  if (shouldShowAnyTabSection) {
    menus = menus.concat({
      id: 'separator-tab-2',
      type: 'separator',
      contexts: ['tab'],
    });
  }

  if (shouldShowAnyTabSection) {
    menus = menus.concat(createSelectedTabsMenus(multipleLinksFormats, builtInStyles));
  }

  return menus;
}

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

export function createBrowserContextMenuService(
  customFormatsProvider: CustomFormatsListProvider,
  builtInStyleSettingsProvider: BuiltInStyleSettingsProvider,
): ContextMenuService {
  return createContextMenuService(browser.contextMenus, customFormatsProvider, builtInStyleSettingsProvider);
}
