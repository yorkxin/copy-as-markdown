import Settings from './lib/settings.js';
import writeUsingContentScript from './lib/clipboard-access.js';
import Markdown from './lib/markdown.js';
import { asyncTabsQuery } from './lib/hacks.js';

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

const ALARM_REFRESH_MENU = 'refreshMenu';

const markdownInstance = new Markdown();

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
    title: 'Copy [Page Title](URL)',
    type: 'normal',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'link',
    title: 'Copy [Link Content](URL)',
    type: 'normal',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'image',
    title: 'Copy ![](Image URL)', // TODO: how to fetch alt text?
    type: 'normal',
    contexts: ['image'],
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

    default: {
      throw new TypeError(`unknown context menu: ${info}`);
    }
  }
  return text;
}

async function handleExport(action) {
  switch (action) {
    case 'current-tab-link': {
      const tabs = await asyncTabsQuery({ currentWindow: true, active: true });
      if (tabs.length !== 1) {
        throw new Error(`Expecting exactly 1 tab, got ${tabs.length} items.`);
      }

      const onlyOneTab = tabs[0];
      return markdownInstance.linkTo(onlyOneTab.title, onlyOneTab.url);
    }

    case 'all-tabs-link-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return markdownInstance.links(tabs, {});
    }

    case 'all-tabs-title-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return markdownInstance.list(tabs.map((tab) => tab.title));
    }

    case 'all-tabs-url-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return markdownInstance.list(tabs.map((tab) => tab.url));
    }

    case 'highlighted-tabs-link-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return markdownInstance.links(tabs, {});
    }

    case 'highlighted-tabs-title-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return markdownInstance.list(tabs.map((tab) => tab.title));
    }

    case 'highlighted-tabs-url-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return markdownInstance.list(tabs.map((tab) => tab.url));
    }

    default: {
      throw new TypeError(`Unknown action: ${action}`);
    }
  }
}

async function mustGetCurrentTab() {
  const tabs = await asyncTabsQuery({ currentWindow: true, active: true });
  if (tabs.length !== 1) {
    return Promise.reject(new Error('failed to get current tab'));
  }

  return Promise.resolve(tabs[0]);
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
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const tab = await mustGetCurrentTab();
    const text = await handleExport(command);
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

    case 'export': {
      handleExport(message.params.action)
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
