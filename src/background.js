import Settings from './lib/settings.js';
import writeUsingContentScript from './lib/clipboard-access.js';
import Markdown from './lib/markdown.js';
import { asyncTabsQuery } from './lib/hacks.js';
import {
  Tab, TabGroup, TabListGrouper,
} from './lib/tabs.js';

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

const ALARM_REFRESH_MENU = 'refreshMenu';

const markdownInstance = new Markdown();
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

  let unorderedListChar = '';
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
}

async function flashBadge(type) {
  const entrypoint = chrome.action /* MV3 */ || chrome.browserAction; /* Firefox MV2 */

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

  chrome.alarms.create('clear', { when: Date.now() + FLASH_BADGE_TIMEOUT });
}

function createMenus() {
  chrome.contextMenus.create({
    id: 'current-page',
    title: 'Copy Page Link as Markdown',
    type: 'normal',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'link',
    title: 'Copy Link as Markdown',
    type: 'normal',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'image',
    title: 'Copy Image as Markdown', // TODO: how to fetch alt text?
    type: 'normal',
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id: 'selection-as-markdown',
    title: 'Copy Selection as Markdown',
    type: 'normal',
    contexts: ['selection'],
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  const entrypoint = chrome.action /* MV3 */ || chrome.browserAction; /* Firefox MV2 */

  if (alarm.name === 'clear') {
    Promise.all([
      entrypoint.setBadgeText({ text: TEXT_EMPTY }),
      entrypoint.setBadgeBackgroundColor({ color: COLOR_OPAQUE }),
    ])
      .then(() => { /* NOP */ });
  }

  if (alarm.name === ALARM_REFRESH_MENU) {
    chrome.contextMenus.removeAll(createMenus);
  }
});

// NOTE: this function should be executed in content script.
function selectionToMarkdown(turndownOptions) {
  // eslint-disable-next-line no-undef
  const turndownService = new TurndownService(turndownOptions);
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

function getTurndownOptions() {
  return {
    // For all options see https://github.com/mixmark-io/turndown?tab=readme-ov-file#options
    headingStyle: 'atx',
    bulletListMarker: markdownInstance.unorderedListChar,
  };
}

async function convertSelectionInTabToMarkdown(tab) {
  // XXX: In Firefox MV2, executeScript() does not return results.
  // We must use browser.scripting instead of chrome.scripting .
  const entrypoint = (typeof browser !== 'undefined') ? browser.scripting : chrome.scripting;
  await entrypoint.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['dist/vendor/turndown.js'],
  });
  const results = await entrypoint.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: selectionToMarkdown,
    args: [
      getTurndownOptions(),
    ],
  });

  return results.map((frame) => frame.result).join('\n\n');
}

async function handleContentOfContextMenu(info, tab) {
  let text;
  switch (info.menuItemId) {
    case 'current-page': {
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

    default: {
      throw new TypeError(`unknown context menu: ${info}`);
    }
  }
  return text;
}

/**
 *
 * @param format {'link'}
 * @param tabId {number}
 * @returns {Promise<string>}
 */
async function handleExportTab(format, tabId) {
  const tab = await chrome.tabs.get(tabId);

  switch (format) {
    case 'link':
      return markdownInstance.linkTo(tab.title, tab.url);

    default:
      throw new TypeError(`invalid format: ${format}`);
  }
}

/**
 *
 * @param tabLists {TabList[]}
 * @param formatter {function(Tab) : string}
 * @returns {string[]|string[][]}
 */
function formatItems(tabLists, formatter) {
  /** @type {string[]|string[][]} */
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
 * @param scope {'all'|'highlighted'}
 * @param format {'link','title','url'}
 * @param listType {'list','task-list'}
 * @param windowId {number}
 * @returns {Promise<string>}
 */
async function handleExportTabs(scope, format, listType, windowId) {
  /** @type {chrome.tabs.QueryInfo} */
  const query = {
    highlighted: (scope === 'highlighted' ? true : undefined),
    windowId,
  };

  /** @type {chrome.tabGroups.TabGroup[]} */
  const crGroups = Object.hasOwn(chrome, 'tabGroups') ? await chrome.tabGroups.query({ windowId }) : [];
  const crTabs = await asyncTabsQuery(query);

  // Everything above depends on chrome|browser

  /** @type {TabGroup[]} */
  const groups = crGroups.map((group) => new TabGroup(group.title, group.id, group.color));
  const tabs = crTabs.map((tab) => new Tab(tab.title, tab.url, tab.groupId || TabGroup.NonGroupId));
  const tabLists = new TabListGrouper(groups).collectTabsByGroup(tabs);

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

chrome.runtime.onInstalled.addListener(createMenus);

// eslint-disable-next-line no-undef
if (globalThis.PERIDOCIALLY_REFRESH_MENU === true) {
  // Hack for Firefox, in which Context Menu disappears after some time.
  // See https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/7
  console.info('Hack PERIDOCIALLY_REFRESH_MENU is enabled');
  chrome.alarms.create('refreshMenu', { periodInMinutes: 0.5 });
}

// NOTE: All listeners must be registered at top level scope.

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const text = await handleContentOfContextMenu(info, tab);
    await writeUsingContentScript(tab, text);
    await flashBadge('success');
    return Promise.resolve(true);
  } catch (error) {
    console.error(error);
    await flashBadge('fail');
    return Promise.reject(error);
  }
});

// listen to keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    let text = '';
    switch (command) {
      case 'selection-as-markdown':
        text = await convertSelectionInTabToMarkdown(tab);
        break;
      case 'current-tab-link':
        text = await handleExportTab('link', tab.id);
        break;
      case 'all-tabs-link-as-list':
        text = await handleExportTabs('all', 'link', 'list', tab.windowId);
        break;
      case 'all-tabs-link-as-task-list':
        text = await handleExportTabs('all', 'link', 'task-list', tab.windowId);
        break;
      case 'all-tabs-title-as-list':
        text = await handleExportTabs('all', 'title', 'list', tab.windowId);
        break;
      case 'all-tabs-url-as-list':
        text = await handleExportTabs('all', 'url', 'list', tab.windowId);
        break;
      case 'highlighted-tabs-link-as-list':
        text = await handleExportTabs('highlighted', 'link', 'list', tab.windowId);
        break;
      case 'highlighted-tabs-link-as-task-list':
        text = await handleExportTabs('highlighted', 'link', 'task-list', tab.windowId);
        break;
      case 'highlighted-tabs-title-as-list':
        text = await handleExportTabs('highlighted', 'title', 'list', tab.windowId);
        break;
      case 'highlighted-tabs-url-as-list':
        text = await handleExportTabs('highlighted', 'url', 'list', tab.windowId);
        break;
      default:
        throw new TypeError(`unknown keyboard command: ${command}`);
    }

    await writeUsingContentScript(tab, text);
    await flashBadge('success');
    return Promise.resolve(true);
  } catch (e) {
    console.error(e);
    await flashBadge('fail');
    return Promise.reject(e);
  }
});

// listen to messages from popup
// NOTE: async function will not work here
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.topic) {
    case 'badge': {
      flashBadge(message.params.type)
        .then(() => {
          sendResponse({ ok: true });
        }, (error) => {
          sendResponse({ ok: false, error });
        });
      break;
    }

    case 'export-current-tab': {
      handleExportTab(message.params.format, message.params.tabId)
        .then((text) => {
          sendResponse({ ok: true, text });
        }, (error) => {
          sendResponse({ ok: false, error });
        });
      break;
    }

    case 'export-tabs': {
      handleExportTabs(
        message.params.scope,
        message.params.format,
        message.params.listType,
        message.params.windowId,
      )
        .then((text) => {
          sendResponse({ ok: true, text });
        }, (error) => {
          sendResponse({ ok: false, error });
        });
      break;
    }

    case 'settings-updated': {
      refreshMarkdownInstance();
      break;
    }

    default: {
      throw TypeError(`Unknown message topic '${message.topic}'`);
    }
  }

  // Must return true to indicate async. See https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
  return true;
});

refreshMarkdownInstance();
