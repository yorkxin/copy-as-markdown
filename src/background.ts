import Settings from './lib/settings';
import copy from './content-script';
import Markdown from './lib/markdown';
import { Tab, TabGroup, TabListGrouper, TabList } from './lib/tabs';
import { Bookmarks } from './bookmarks';
import CustomFormatsStorage from './storage/custom-formats-storage';
import CustomFormat from './lib/custom-format';
import type { NestedArray } from './lib/markdown';
import type { Options as TurndownOptions } from 'turndown';

type CustomFormatSubject = 'all-tabs' | 'highlighted-tabs' | 'current-tab' | 'link';

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE: browser.action.ColorArray = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

const ALARM_REFRESH_MENU = 'refreshMenu';

const markdownInstance = new Markdown();
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

const FORMAT_TO_FUNCTION: Record<string, (tab: Tab) => string> = {
  link: (tab) => `[${tab.title}](${tab.url})`,
  title: (tab) => tab.title,
  url: (tab) => tab.url,
};

async function refreshMarkdownInstance(): Promise<void> {
  let settings;
  try {
    settings = await Settings.getAll();
  } catch (error) {
    console.error('error getting settings', error);
    return;
  }

  let unorderedListChar: '-' | '*' | '+';
  switch (settings.styleOfUnorderedList) {
    case 'dash':
      unorderedListChar = '-';
      break;
    case 'asterisk':
      unorderedListChar = '*';
      break;
    case 'plus':
      unorderedListChar = '+';
      break;
    default:
      console.error('unrecognized style of unordered list:', settings.styleOfUnorderedList);
      unorderedListChar = '-';
  }
  markdownInstance.alwaysEscapeLinkBracket = settings.alwaysEscapeLinkBrackets;
  markdownInstance.unorderedListChar = unorderedListChar;
  markdownInstance.nestedListIndentation = settings.styleOfTabGroupIndentation;
}

async function flashBadge(type: 'success' | 'fail'): Promise<void> {
  const entrypoint = (typeof browser.browserAction !== 'undefined') ? browser.browserAction : chrome.action;
  switch (type) {
    case 'success':
      await entrypoint.setBadgeText({ text: TEXT_OK });
      await entrypoint.setBadgeBackgroundColor({ color: COLOR_GREEN });
      break;
    case 'fail':
      await entrypoint.setBadgeText({ text: TEXT_ERROR });
      await entrypoint.setBadgeBackgroundColor({ color: COLOR_RED });
      break;
    default:
      return; // don't know what it is. quit.
  }

  browser.alarms.create('clear', { when: Date.now() + FLASH_BADGE_TIMEOUT });
}

async function createMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: 'current-tab',
    title: 'Copy Page Link as Markdown',
    type: 'normal',
    contexts: ['page'],
  });

  browser.contextMenus.create({
    id: 'link',
    title: 'Copy Link as Markdown',
    type: 'normal',
    contexts: ['link'],
  });

  const singleLinkFormats = (await CustomFormatsStorage.list('single-link'))
    .filter((format) => format.showInMenus);
  singleLinkFormats.forEach((format) => {
    browser.contextMenus.create({
      id: `current-tab-custom-format-${format.slot}`,
      title: `Copy Page Link (${format.displayName})`,
      contexts: ['page'],
    });
    browser.contextMenus.create({
      id: `link-custom-format-${format.slot}`,
      title: `Copy Link (${format.displayName})`,
      contexts: ['link'],
    });
  });

  browser.contextMenus.create({
    id: 'image',
    title: 'Copy Image as Markdown', // TODO: how to fetch alt text?
    type: 'normal',
    contexts: ['image'],
  });

  browser.contextMenus.create({
    id: 'selection-as-markdown',
    title: 'Copy Selection as Markdown',
    type: 'normal',
    contexts: ['selection'],
  });

  /* The following menu items are Firefox-only */

  try {
    const multipleLinksFormats = (await CustomFormatsStorage.list('multiple-links'))
      .filter((format) => format.showInMenus);

    await browser.contextMenus.update('current-tab', {
      contexts: [
        'page',
        'tab', // only available on Firefox
      ],
    });

    // eslint-disable-next-line no-restricted-syntax
    for await (const format of singleLinkFormats) {
      await browser.contextMenus.update(`current-tab-custom-format-${format.slot}`, {
        contexts: [
          'page',
          'tab', // only available on Firefox
        ],
      });
    }

    browser.contextMenus.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['tab'],
    });

    browser.contextMenus.create({
      id: 'all-tabs-list',
      title: 'Copy All Tabs',
      type: 'normal',
      contexts: ['tab'],
    });

    browser.contextMenus.create({
      id: 'all-tabs-task-list',
      title: 'Copy All Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });

    // eslint-disable-next-line no-restricted-syntax
    for await (const format of multipleLinksFormats) {
      browser.contextMenus.create({
        id: `all-tabs-custom-format-${format.slot}`,
        title: `Copy All Tabs (${format.displayName})`,
        type: 'normal',
        contexts: ['tab'],
      });
    }

    browser.contextMenus.create({
      id: 'separator-2',
      type: 'separator',
      contexts: ['tab'],
    });

    browser.contextMenus.create({
      id: 'highlighted-tabs-list',
      title: 'Copy Selected Tabs',
      type: 'normal',
      contexts: ['tab'],
    });

    browser.contextMenus.create({
      id: 'highlighted-tabs-task-list',
      title: 'Copy Selected Tabs (Task List)',
      type: 'normal',
      contexts: ['tab'],
    });

    // eslint-disable-next-line no-restricted-syntax
    for await (const format of multipleLinksFormats) {
      browser.contextMenus.create({
        id: `highlighted-tabs-custom-format-${format.slot}`,
        title: `Copy Selected Tabs (${format.displayName})`,
        type: 'normal',
        visible: format.showInMenus,
        contexts: ['tab'],
      });
    }
  } catch (error) {
    console.info('this browser does not support context contextMenus on tab bar');
  }

  try {
    browser.contextMenus.create({
      id: 'bookmark-link',
      title: 'Copy Bookmark or Folder as Markdown',
      type: 'normal',
      contexts: ['bookmark'],
    });
  } catch (error) {
    console.info('this browser does not support context contextMenus on bookmarks');
  }
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  const entrypoint = (typeof browser.browserAction !== 'undefined') ? browser.browserAction : chrome.action;
  if (alarm.name === 'clear') {
    await Promise.all([
      entrypoint.setBadgeText({ text: TEXT_EMPTY }),
      entrypoint.setBadgeBackgroundColor({ color: COLOR_OPAQUE }),
    ]);
  }

  if (alarm.name === ALARM_REFRESH_MENU) {
    await browser.contextMenus.removeAll();
    createMenus();
  }
});

// NOTE: this function should be executed in content script.
function selectionToMarkdown(turndownOptions: TurndownOptions): string {
  const TurndownService = (globalThis as any).TurndownService;
  const turndownService = new TurndownService(turndownOptions)
    .remove('script')
    .remove('style');
  const sel = getSelection();
  const container = document.createElement('div');
  if (!sel) {
    return '';
  }
  for (let i = 0, len = sel.rangeCount; i < len; i += 1) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }

  // Fix <a href> so that they are absolute URLs
  container.querySelectorAll('a').forEach((value) => {
    value.setAttribute('href', value.href);
  });

  // Fix <img src> so that they are absolute URLs
  container.querySelectorAll('img').forEach((value) => {
    value.setAttribute('src', value.src);
  });
  const html = container.innerHTML;
  return turndownService.turndown(html);
}

function getTurndownOptions(): TurndownOptions {
  return {
    // For all options see https://github.com/mixmark-io/turndown?tab=readme-ov-file#options
    headingStyle: 'atx',
    bulletListMarker: markdownInstance.unorderedListChar,
  };
}

function formatItems(tabLists: TabList[], formatter: (tab: Tab) => string): NestedArray {
  const items: NestedArray = [];

  tabLists.forEach((tabList) => {
    if (tabList.groupId === TabGroup.NonGroupId) {
      tabList.tabs.forEach((tab) => {
        items.push(formatter(tab));
      });
    } else {
      items.push(tabList.name);
      const sublist = tabList.tabs.map(formatter);
      items.push(sublist);
    }
  });

  return items;
}

async function getTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
  let granted = false;
  try {
    granted = await browser.permissions.contains({ permissions: ['tabGroups'] });
  } catch (e) {
    // tabGroups is only supported in Chrome/Chromium
    return [];
  }

  if (!granted) {
    return [];
  }

  // For Firefox mv2 compatibility
  return new Promise((resolve, reject) => {
    chrome.tabGroups.query({ windowId }, (groups) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(groups);
      }
    });
  });
}

function renderBuiltInFormat(
  format: 'link' | 'title' | 'url',
  tabLists: TabList[],
  listType: 'list' | 'task-list'
): string {
  const formatter = FORMAT_TO_FUNCTION[format];
  if (!formatter) {
    throw new TypeError(`unknown format: ${format}`);
  }
  const items = formatItems(tabLists, formatter);

  switch (listType) {
    case 'list':
      return markdownInstance.list(items);
    case 'task-list':
      return markdownInstance.taskList(items);
    default:
      throw new TypeError(`unknown listType: ${listType}`);
  }
}

async function renderCustomFormatForSingleTab({
  slot,
  title,
  url,
}: {
  slot: string;
  title: string;
  url: string;
}): Promise<string> {
  const customFormat = await CustomFormatsStorage.get('single-link', slot);
  const input = { title, url, number: 1 };
  return customFormat.render(input);
}

async function renderCustomFormatForMultipleTabs({
  slot,
  lists,
}: {
  slot: string;
  lists: TabList[];
}): Promise<string> {
  const customFormat = await CustomFormatsStorage.get('multiple-links', slot);
  const input = CustomFormat.makeRenderInputForTabLists(lists);
  return customFormat.render(input);
}

async function handleExportTabs({
  scope,
  format,
  customFormatSlot,
  listType,
  windowId,
}: {
  scope: 'all' | 'highlighted';
  format: 'link' | 'title' | 'url' | 'custom-format';
  customFormatSlot?: string;
  listType?: 'list' | 'task-list';
  windowId: number;
}): Promise<string> {
  if (format === 'custom-format') {
    if (listType !== null && listType !== undefined) {
      throw new TypeError('listType is not allowed if format is custom-format');
    }
    if (!customFormatSlot) {
      throw new TypeError('customFormatSlot is required if format is custom-format');
    }
  }

  if (!await browser.permissions.contains({ permissions: ['tabs'] })) {
    await browser.windows.create({
      focused: true,
      type: 'popup',
      width: 640,
      height: 480,
      url: '/dist/ui/permissions.html?permissions=tabs',
    });
    throw new Error('permission required');
  }

  const crTabs = await browser.tabs.query({
    highlighted: (scope === 'highlighted' ? true : undefined),
    windowId,
  });
  const crGroups = await getTabGroups(windowId);
  const groups = crGroups.map((group) => new TabGroup(group.title || '', group.id, group.color || ''));
  const tabs = crTabs.map((tab) => new Tab(
    markdownInstance.escapeLinkText(tab.title || ''),
    tab.url || '',
    (tab as any).groupId || TabGroup.NonGroupId
  ));
  const tabLists = new TabListGrouper(groups).collectTabsByGroup(tabs);
  if (format === 'custom-format') {
    if (!customFormatSlot) {
      throw new TypeError('customFormatSlot is required');
    }
    return renderCustomFormatForMultipleTabs({ slot: customFormatSlot, lists: tabLists });
  }
  return renderBuiltInFormat(format, tabLists, listType!);
}

async function convertSelectionInTabToMarkdown(tab: browser.tabs.Tab): Promise<string> {
  if (!tab.id) {
    throw new Error('tab has no id');
  }
  await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['dist/vendor/turndown.js'],
  });
  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: selectionToMarkdown as any,
    args: [
      getTurndownOptions(),
    ],
  });

  return results.map((frame) => frame.result as string).join('\n\n');
}

function parseCustomFormatCommand(command: string): { context: CustomFormatSubject; slot: string } {
  const match = /(all-tabs|highlighted-tabs|current-tab|link)-custom-format-(\d)/.exec(command);
  if (match === null) {
    throw new TypeError(`unknown command: ${command}`);
  }
  const context = match[1] as CustomFormatSubject;
  const slot = match[2]!;
  return {
    context,
    slot,
  };
}

async function handleCustomFormatCurrentPage(slot: string, tab: browser.tabs.Tab): Promise<string> {
  return handleExportLink({
    format: 'custom-format',
    customFormatSlot: slot,
    title: tab.title || '',
    url: tab.url || '',
  });
}

async function handleCustomFormatLink(slot: string, menuInfo: browser.contextMenus.OnClickData): Promise<string> {
  // linkText for Firefox (as of 2018/03/07)
  // selectionText for Chrome on Mac only. On Windows it does not highlight text when
  // right-click.
  // TODO: use linkText when Chrome supports it on stable.
  const linkText = menuInfo.selectionText || menuInfo.linkText || '';

  return handleExportLink({
    format: 'custom-format',
    customFormatSlot: slot,
    title: linkText,
    url: menuInfo.linkUrl || '',
  });
}

async function handleCustomFormatTabs(
  scope: 'all' | 'highlighted',
  slot: string,
  windowId: number
): Promise<string> {
  return handleExportTabs({
    scope,
    format: 'custom-format',
    customFormatSlot: slot,
    windowId,
  });
}

async function handleContentOfContextMenu(
  info: browser.contextMenus.OnClickData,
  tab: browser.tabs.Tab
): Promise<string> {
  let text: string;

  switch (info.menuItemId) {
    case 'current-tab': {
      text = markdownInstance.linkTo(tab.title || '', tab.url || '');
      break;
    }

    case 'link': {
      /* <a href="linkURL"><img src="srcURL" /></a> */
      if (info.mediaType === 'image') {
        // TODO: extract image alt text
        text = Markdown.linkedImage('', info.srcUrl || '', info.linkUrl || '');
        break;
      }

      /* <a href="linkURL">Text</a> */

      // linkText for Firefox (as of 2018/03/07)
      // selectionText for Chrome on Mac only. On Windows it does not highlight text when
      // right-click.
      // TODO: use linkText when Chrome supports it on stable.
      const linkText = info.selectionText || info.linkText || '';

      text = markdownInstance.linkTo(linkText, info.linkUrl || '');
      break;
    }

    case 'image': {
      // TODO: extract image alt text
      text = Markdown.imageFor('', info.srcUrl || '');
      break;
    }

    case 'selection-as-markdown': {
      text = await convertSelectionInTabToMarkdown(tab);
      break;
    }

    // Only available on Firefox
    case 'all-tabs-list': {
      if (tab.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await handleExportTabs({
        scope: 'all', format: 'link', listType: 'list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'all-tabs-task-list': {
      if (tab.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await handleExportTabs({
        scope: 'all', format: 'link', listType: 'task-list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-list': {
      if (tab.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await handleExportTabs({
        scope: 'highlighted', format: 'link', listType: 'list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-task-list': {
      if (tab.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await handleExportTabs({
        scope: 'highlighted', format: 'link', listType: 'task-list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'bookmark-link': {
      const bm = await browser.bookmarks.getSubTree(info.bookmarkId!);
      if (bm.length === 0) {
        throw new Error('bookmark not found');
      }
      text = bookmarks.toMarkdown(bm[0]!);
      break;
    }

    default: {
      const {
        context,
        slot,
      } = parseCustomFormatCommand(info.menuItemId.toString());

      switch (context) {
        case 'current-tab': {
          text = await handleCustomFormatCurrentPage(slot, tab);
          break;
        }
        case 'link': {
          text = await handleCustomFormatLink(slot, info);
          break;
        }
        case 'all-tabs': {
          if (tab.windowId === undefined) {
            throw new Error('tab has no windowId');
          }
          text = await handleCustomFormatTabs('all', slot, tab.windowId);
          break;
        }
        case 'highlighted-tabs': {
          if (tab.windowId === undefined) {
            throw new Error('tab has no windowId');
          }
          text = await handleCustomFormatTabs('highlighted', slot, tab.windowId);
          break;
        }
        default:
          throw new TypeError(`unknown context menu custom format: ${info.menuItemId}`);
      }
    }
  }
  return text;
}

async function handleExportLink({
  format,
  customFormatSlot,
  title,
  url,
}: {
  format: 'link' | 'custom-format';
  customFormatSlot?: string | null;
  title: string;
  url: string;
}): Promise<string> {
  switch (format) {
    case 'link':
      return markdownInstance.linkTo(title, url);

    case 'custom-format':
      if (!customFormatSlot) {
        throw new TypeError('customFormatSlot is required for custom-format');
      }
      return renderCustomFormatForSingleTab({
        slot: customFormatSlot,
        title: markdownInstance.escapeLinkText(title),
        url,
      });

    default:
      throw new TypeError(`invalid format: ${format}`);
  }
}

async function copyUsingContentScript(tab: browser.tabs.Tab, text: string): Promise<boolean> {
  if (!tab.id) {
    throw new Error('tab has no id');
  }
  const results = await browser.scripting.executeScript({
    target: {
      tabId: tab.id,
    },
    func: copy as any,
    args: [text, browser.runtime.getURL('dist/iframe-copy.html')],
  });

  const firstResult = results[0];
  if (!firstResult) {
    throw new Error('no result from content script');
  }
  const { result } = firstResult;
  if (result.ok) {
    return true;
  }
  throw new Error(`content script failed: ${result.error} (method = ${result.method})`);
}

createMenus().then(() => null /* NOP */);
browser.storage.sync.onChanged.addListener(async (changes) => {
  if (Object.keys(changes).indexOf(CustomFormatsStorage.KeyOfLastUpdate()) !== -1) {
    await createMenus();
  }
});

// eslint-disable-next-line no-undef
if ((globalThis as any).PERIDOCIALLY_REFRESH_MENU === true) {
  // Hack for Firefox, in which Context Menu disappears after some time.
  // See https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/7
  console.info('Hack PERIDOCIALLY_REFRESH_MENU is enabled');
  browser.alarms.create('refreshMenu', { periodInMinutes: 0.5 });
}

// NOTE: All listeners must be registered at top level scope.

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) {
    console.error('tab is undefined');
    await flashBadge('fail');
    return false;
  }
  try {
    const text = await handleContentOfContextMenu(info, tab);
    // eslint-disable-next-line no-undef
    if ((globalThis as any).ALWAYS_USE_NAVIGATOR_COPY_API === true) {
      await navigator.clipboard.writeText(text);
    } else {
      await copyUsingContentScript(tab, text);
    }
    await flashBadge('success');
    return true;
  } catch (error) {
    console.error(error);
    await flashBadge('fail');
    throw error;
  }
});

// mustGetCurrentTab() is made for Firefox in which in some
// contexts tabs.getCurrent() returns undefined.
async function mustGetCurrentTab(): Promise<browser.tabs.Tab> {
  const tabs = await browser.tabs.query({
    currentWindow: true,
    active: true,
  });
  if (tabs.length !== 1) {
    throw new Error('failed to get current tab');
  }
  return tabs[0]!;
}

// listen to keyboard shortcuts
browser.commands.onCommand.addListener(async (command: string, argTab?: browser.tabs.Tab) => {
  let tab = argTab;
  if (typeof tab === 'undefined') {
    // tab argument is not available on Firefox.
    // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/commands/onCommand

    tab = await mustGetCurrentTab();
  }
  try {
    let text = '';
    const windowId = tab.windowId;
    if (windowId === undefined) {
      throw new Error('tab has no windowId');
    }

    switch (command) {
      case 'selection-as-markdown':
        text = await convertSelectionInTabToMarkdown(tab);
        break;
      case 'current-tab-link':
        text = await handleExportLink({ format: 'link', title: tab.title || '', url: tab.url || '' });
        break;
      case 'all-tabs-link-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'link', listType: 'list', windowId,
        });
        break;
      case 'all-tabs-link-as-task-list':
        text = await handleExportTabs({
          scope: 'all', format: 'link', listType: 'task-list', windowId,
        });
        break;
      case 'all-tabs-title-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'title', listType: 'list', windowId,
        });
        break;
      case 'all-tabs-url-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'url', listType: 'list', windowId,
        });
        break;
      case 'highlighted-tabs-link-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'link', listType: 'list', windowId,
        });
        break;
      case 'highlighted-tabs-link-as-task-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'link', listType: 'task-list', windowId,
        });
        break;
      case 'highlighted-tabs-title-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'title', listType: 'list', windowId,
        });
        break;
      case 'highlighted-tabs-url-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'url', listType: 'list', windowId,
        });
        break;
      default: {
        try {
          const {
            context,
            slot,
          } = parseCustomFormatCommand(command);

          switch (context) {
            case 'current-tab': {
              text = await handleCustomFormatCurrentPage(slot, tab);
              break;
            }
            case 'all-tabs': {
              text = await handleCustomFormatTabs('all', slot, windowId);
              break;
            }
            case 'highlighted-tabs': {
              text = await handleCustomFormatTabs('highlighted', slot, windowId);
              break;
            }
            default:
              throw new TypeError(`unknown keyboard custom format: ${command}`);
          }
        } catch (e) {
          throw new TypeError(`unknown keyboard command: ${command}`);
        }
      }
    }

    // eslint-disable-next-line no-undef
    if ((globalThis as any).ALWAYS_USE_NAVIGATOR_COPY_API) {
      await navigator.clipboard.writeText(text);
    } else {
      await copyUsingContentScript(tab, text);
    }
    await flashBadge('success');
    return true;
  } catch (e) {
    console.error(e);
    await flashBadge('fail');
    throw e;
  }
});

async function handleRuntimeMessage(
  topic: 'badge' | 'export-current-tab' | 'export-tabs',
  params: any
): Promise<string | null> {
  switch (topic) {
    case 'badge': {
      await flashBadge(params.type);
      return null;
    }

    case 'export-current-tab': {
      const tab = await browser.tabs.get(params.tabId);
      if (typeof tab === 'undefined') {
        throw new Error('got undefined tab');
      }
      return handleExportLink({
        format: params.format,
        customFormatSlot: params.customFormatSlot,
        title: tab.title || '',
        url: tab.url || '',
      });
    }

    case 'export-tabs': {
      return handleExportTabs(params);
    }

    default: {
      throw TypeError(`Unknown message topic '${topic}'`);
    }
  }
}

// listen to messages from popup
// NOTE: async function will not work here
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleRuntimeMessage(message.topic, message.params)
    .then((text) => sendResponse({ ok: true, text }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  // Must return true to indicate async. See https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
  return true;
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.entries(changes)
    .filter(([key]) => Settings.keys.includes(key))
    .length > 0;
  if (hasSettingsChanged) {
    await refreshMarkdownInstance();
  }
});

refreshMarkdownInstance()
  .then(() => null /* NOP */);
