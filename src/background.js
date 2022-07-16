import * as BrowserAsMarkdown from './lib/browser-as-markdown.js';
import * as Markdown from './lib/markdown.js';
import copy from './lib/clipboard-access.js';
import { asyncTabsQuery } from './lib/hacks.js';

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

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

  setTimeout(async () => {
    await entrypoint.setBadgeText({ text: TEXT_EMPTY });
    await entrypoint.setBadgeBackgroundColor({ color: COLOR_OPAQUE });
  }, FLASH_BADGE_TIMEOUT);
}

chrome.runtime.onInstalled.addListener(() => {
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
});

// NOTE: All listeners must be registered at top level scope.

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let text;
  switch (info.menuItemId) {
    case 'current-page': {
      text = Markdown.linkTo(tab.title, tab.url);
      break;
    }

    case 'link': {
      text = BrowserAsMarkdown.onClickLink(info);
      break;
    }

    case 'image': {
      text = Markdown.imageFor('', info.srcUrl);
      break;
    }

    default: {
      throw new TypeError(`unknown context menu: ${info}`);
    }
  }

  try {
    // Insert content script to run 'copy' command
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copy,
      args: [text],
    });

    await flashBadge('success');
  } catch (error) {
    console.error(error);
    await flashBadge('fail');
  }
});

// listen to keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const text = await BrowserAsMarkdown.handleExport(command);
    const tabs = await asyncTabsQuery({ currentWindow: true, active: true });
    if (tabs.length !== 1) {
      return Promise.reject(new Error('failed to get current tab'));
    }
    const injectingTab = tabs[0];

    // Insert content script to run 'copy' command
    await chrome.scripting.executeScript({
      target: { tabId: injectingTab.id },
      func: copy,
      args: [text],
    });

    await flashBadge('success');
    return Promise.resolve(text);
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
      BrowserAsMarkdown.handleExport(message.params.action)
        .then((text) => {
          sendResponse({ ok: true, text });
        }, (error) => {
          sendResponse({ ok: false, error });
        });
      break;
    }

    default: {
      throw TypeError(`Unknown message topic '${message.topic}'`);
    }
  }

  // Must return true to indicate async. See https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
  return true;
});
