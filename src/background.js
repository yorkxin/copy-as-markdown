import Settings from './lib/settings.js';
import copy from './content-script.js';
import Markdown from './lib/markdown.js';
import { Tab, TabGroup, TabListGrouper } from './lib/tabs.js';
import { Bookmarks } from './bookmarks.js';
import CustomFormatsStorage from './storage/custom-formats-storage.js';
import CustomFormat from './lib/custom-format.js';

/** @typedef {'all-tabs'|'highlighted-tabs'|'current-tab'|'link'} CustomFormatSubject */

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
/** @type {browser.action.ColorArray} */
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

const ALARM_REFRESH_MENU = 'refreshMenu';

const markdownInstance = new Markdown();
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

/**
 *
 * @type {Record<string, function(Tab): string>}
 */
const FORMAT_TO_FUNCTION = {
  link: (tab) => `[${tab.title}](${tab.url})`,
  title: (tab) => tab.title,
  url: (tab) => tab.url,
};

async function refreshMarkdownInstance() {
  let settings;
  try {
    settings = await Settings.getAll();
  } catch (error) {
    console.error('error getting settings', error);
  }

  /** @type {'-'|'*'|'+'} */
  let unorderedListChar;
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

async function flashBadge(type) {
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

async function createMenus() {
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
/**
 *
 * @param {import('turndown').Options} turndownOptions
 * @returns {string}
 */
function selectionToMarkdown(turndownOptions) {
  // eslint-disable-next-line no-undef
  const turndownService = new TurndownService(turndownOptions)
    .remove('script')
    .remove('style');
  const sel = getSelection();
  const container = document.createElement('div');
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

/**
 *
 * @returns {import('turndown').Options}
 */
function getTurndownOptions() {
  return {
    // For all options see https://github.com/mixmark-io/turndown?tab=readme-ov-file#options
    headingStyle: 'atx',
    bulletListMarker: markdownInstance.unorderedListChar,
  };
}

/**
 *
 * @param {import('./lib/custom-format.js').TabList[]} tabLists
 * @param {function(Tab) : string} formatter
 * @returns {import('./lib/markdown.js').NestedArray}
 */
function formatItems(tabLists, formatter) {
  /** @type {import('./lib/markdown.js').NestedArray} */
  const items = [];

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

/**
 *
 * @param {number} windowId
 * @returns {Promise<chrome.tabGroups.TabGroup[]>}
 */
async function getTabGroups(windowId) {
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

/**
 *
 * @param {'link'|'title'|'url'} format
 * @param {import('./lib/custom-format.js').TabList[]} tabLists
 * @param {'list'|'task-list'} listType
 * @returns {string}
 */
function renderBuiltInFormat(format, tabLists, listType) {
  const formatter = FORMAT_TO_FUNCTION[format];
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

/**
 *
 * @param {Object} options
 * @param {string} options.slot - Custom format slot identifier
 * @param {string} options.title - The page title
 * @param {string} options.url - The page URL
 * @returns {Promise<string>}
 */
async function renderCustomFormatForSingleTab({ slot, title, url }) {
  const customFormat = await CustomFormatsStorage.get('single-link', slot);
  const input = { title, url };
  return customFormat.render(input);
}

/**
 *
 * @param {Object} options
 * @param {string} options.slot - Custom format slot identifier
 * @param {import('./lib/tabs.js').TabList[]} options.lists - Array of tab lists to format
 * @returns {Promise<string>}
 */
async function renderCustomFormatForMultipleTabs({ slot, lists }) {
  const customFormat = await CustomFormatsStorage.get('multiple-links', slot);
  const input = CustomFormat.makeRenderInputForTabLists(lists);
  return customFormat.render(input);
}

/**
 *
 * @param {Object} options
 * @param {'all'|'highlighted'} options.scope
 * @param {'link'|'title'|'url'|'custom-format'} options.format
 * @param {string} [options.customFormatSlot] required if options.format is 'custom-format'
 * @param {'list'|'task-list'} [options.listType] required if options.format is not 'custom-format'
 * @param {number} options.windowId
 * @returns {Promise<string>}
 */
async function handleExportTabs({
  scope,
  format,
  customFormatSlot,
  listType,
  windowId,
}) {
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
  const groups = crGroups.map((group) => new TabGroup(group.title, group.id, group.color));
  // eslint-disable-next-line max-len
  const tabs = crTabs.map((tab) => new Tab(markdownInstance.escapeLinkText(tab.title), tab.url, tab.groupId || TabGroup.NonGroupId));
  const tabLists = new TabListGrouper(groups).collectTabsByGroup(tabs);
  if (format === 'custom-format') {
    return renderCustomFormatForMultipleTabs({ slot: customFormatSlot, lists: tabLists });
  }
  return renderBuiltInFormat(format, tabLists, listType);
}

/**
 *
 * @param {browser.tabs.Tab} tab
 * @returns {Promise<string>}
 */
async function convertSelectionInTabToMarkdown(tab) {
  await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['dist/vendor/turndown.js'],
  });
  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: selectionToMarkdown,
    args: [
      getTurndownOptions(),
    ],
  });

  return results.map((frame) => frame.result).join('\n\n');
}

/**
 *
 * @param {string} command
 * @returns {{context: CustomFormatSubject, slot: string}}
 */
function parseCustomFormatCommand(command) {
  const match = /(all-tabs|highlighted-tabs|current-tab|link)-custom-format-(\d)/.exec(command);
  if (match === null) {
    throw new TypeError(`unknown command: ${command}`);
  }
  const context = /** @type {CustomFormatSubject} */ (match[1]);
  const slot = match[2];
  return {
    context,
    slot,
  };
}

/**
 *
 * @param {string} slot
 * @param {browser.tabs.Tab} tab
 * @returns {Promise<string>}
 */
async function handleCustomFormatCurrentPage(slot, tab) {
  // eslint-disable-next-line no-use-before-define
  return handleExportLink({
    format: 'custom-format',
    customFormatSlot: slot,
    title: tab.title,
    url: tab.url,
  });
}

/**
 *
 * @param {string} slot
 * @param {browser.contextMenus.OnClickData} menuInfo
 * @returns {Promise<string>}
 */
async function handleCustomFormatLink(slot, menuInfo) {
  // linkText for Firefox (as of 2018/03/07)
  // selectionText for Chrome on Mac only. On Windows it does not highlight text when
  // right-click.
  // TODO: use linkText when Chrome supports it on stable.
  const linkText = menuInfo.selectionText || menuInfo.linkText;

  // eslint-disable-next-line no-use-before-define
  return handleExportLink({
    format: 'custom-format',
    customFormatSlot: slot,
    title: linkText,
    url: menuInfo.linkUrl,
  });
}

/**
 *
 * @param {'all'|'highlighted'} scope
 * @param {string} slot
 * @param {number} windowId
 * @returns {Promise<string>}
 */
async function handleCustomFormatTabs(scope, slot, windowId) {
  return handleExportTabs({
    scope,
    format: 'custom-format',
    customFormatSlot: slot,
    windowId,
  });
}

/**
 *
 * @param {browser.contextMenus.OnClickData} info
 * @param {browser.tabs.Tab} tab
 * @returns {Promise<string>}
 */
async function handleContentOfContextMenu(info, tab) {
  let text;

  switch (info.menuItemId) {
    case 'current-tab': {
      text = markdownInstance.linkTo(tab.title, tab.url);
      break;
    }

    case 'link': {
      /* <a href="linkURL"><img src="srcURL" /></a> */
      if (info.mediaType === 'image') {
        // TODO: extract image alt text
        text = Markdown.linkedImage('', info.srcUrl, info.linkUrl);
        break;
      }

      /* <a href="linkURL">Text</a> */

      // linkText for Firefox (as of 2018/03/07)
      // selectionText for Chrome on Mac only. On Windows it does not highlight text when
      // right-click.
      // TODO: use linkText when Chrome supports it on stable.
      const linkText = info.selectionText || info.linkText;

      text = markdownInstance.linkTo(linkText, info.linkUrl);
      break;
    }

    case 'image': {
      // TODO: extract image alt text
      text = Markdown.imageFor('', info.srcUrl);
      break;
    }

    case 'selection-as-markdown': {
      text = await convertSelectionInTabToMarkdown(tab);
      break;
    }

    // Only available on Firefox
    case 'all-tabs-list': {
      text = await handleExportTabs({
        scope: 'all', format: 'link', listType: 'list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'all-tabs-task-list': {
      text = await handleExportTabs({
        scope: 'all', format: 'link', listType: 'task-list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-list': {
      text = await handleExportTabs({
        scope: 'highlighted', format: 'link', listType: 'list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-task-list': {
      text = await handleExportTabs({
        scope: 'highlighted', format: 'link', listType: 'task-list', windowId: tab.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'bookmark-link': {
      const bm = await browser.bookmarks.getSubTree(info.bookmarkId);
      if (bm.length === 0) {
        throw new Error('bookmark not found');
      }
      text = bookmarks.toMarkdown(bm[0]);
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
          text = await handleCustomFormatTabs('all', slot, tab.windowId);
          break;
        }
        case 'highlighted-tabs': {
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

/**
 *
 * @param {Object} options
 * @param {'link'|'custom-format'} options.format
 * @param {String|null} [options.customFormatSlot=null]
 * @param {String} options.title
 * @param {String} options.url
 * @returns {Promise<string>}
 */
async function handleExportLink({
  format,
  customFormatSlot,
  title,
  url,
}) {
  switch (format) {
    case 'link':
      return markdownInstance.linkTo(title, url);

    case 'custom-format':
      return renderCustomFormatForSingleTab({
        slot: customFormatSlot,
        title: markdownInstance.escapeLinkText(title),
        url,
      });

    default:
      throw new TypeError(`invalid format: ${format}`);
  }
}

/**
 *
 * @param tab {browser.tabs.Tab}
 * @param text {string}
 * @returns {Promise<boolean>}
 */
async function copyUsingContentScript(tab, text) {
  const results = await browser.scripting.executeScript({
    target: {
      tabId: tab.id,
    },
    func: copy,
    args: [text, browser.runtime.getURL('dist/iframe-copy.html')],
  });

  const { result } = results[0];
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
if (globalThis.PERIDOCIALLY_REFRESH_MENU === true) {
  // Hack for Firefox, in which Context Menu disappears after some time.
  // See https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/7
  console.info('Hack PERIDOCIALLY_REFRESH_MENU is enabled');
  browser.alarms.create('refreshMenu', { periodInMinutes: 0.5 });
}

// NOTE: All listeners must be registered at top level scope.

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const text = await handleContentOfContextMenu(info, tab);
    // eslint-disable-next-line no-undef
    if (globalThis.ALWAYS_USE_NAVIGATOR_COPY_API === true) {
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
async function mustGetCurrentTab() {
  const tabs = await browser.tabs.query({
    currentWindow: true,
    active: true,
  });
  if (tabs.length !== 1) {
    throw new Error('failed to get current tab');
  }
  return tabs[0];
}

// listen to keyboard shortcuts
browser.commands.onCommand.addListener(async (command, argTab) => {
  let tab = argTab;
  if (typeof tab === 'undefined') {
    // tab argument is not available on Firefox.
    // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/commands/onCommand

    tab = await mustGetCurrentTab();
  }
  try {
    let text = '';
    switch (command) {
      case 'selection-as-markdown':
        text = await convertSelectionInTabToMarkdown(tab);
        break;
      case 'current-tab-link':
        text = await handleExportLink({ format: 'link', title: tab.title, url: tab.url });
        break;
      case 'all-tabs-link-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'link', listType: 'list', windowId: tab.windowId,
        });
        break;
      case 'all-tabs-link-as-task-list':
        text = await handleExportTabs({
          scope: 'all', format: 'link', listType: 'task-list', windowId: tab.windowId,
        });
        break;
      case 'all-tabs-title-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'title', listType: 'list', windowId: tab.windowId,
        });
        break;
      case 'all-tabs-url-as-list':
        text = await handleExportTabs({
          scope: 'all', format: 'url', listType: 'list', windowId: tab.windowId,
        });
        break;
      case 'highlighted-tabs-link-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'link', listType: 'list', windowId: tab.windowId,
        });
        break;
      case 'highlighted-tabs-link-as-task-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'link', listType: 'task-list', windowId: tab.windowId,
        });
        break;
      case 'highlighted-tabs-title-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'title', listType: 'list', windowId: tab.windowId,
        });
        break;
      case 'highlighted-tabs-url-as-list':
        text = await handleExportTabs({
          scope: 'highlighted', format: 'url', listType: 'list', windowId: tab.windowId,
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
              text = await handleCustomFormatTabs('all', slot, tab.windowId);
              break;
            }
            case 'highlighted-tabs': {
              text = await handleCustomFormatTabs('highlighted', slot, tab.windowId);
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
    if (globalThis.ALWAYS_USE_NAVIGATOR_COPY_API) {
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

/**
 * @param topic {'badge'|'export-current-tab'|'export-tabs'}
 * @param params {Object}
 * @returns {Promise<string|null>}
 */
async function handleRuntimeMessage(topic, params) {
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
        title: tab.title,
        url: tab.url,
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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
