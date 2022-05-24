import * as BrowserAsMarkdown from './lib/browser-as-markdown.js';
import * as Markdown from './lib/markdown.js';
import copy from './lib/clipboard-access.js';

const COLOR_GREEN = '#738a05';
const COLOR_RED = '#d11b24';
const COLOR_OPAQUE = [0, 0, 0, 255];

const TEXT_OK = '✓';
const TEXT_ERROR = '×';
const TEXT_EMPTY = '';

const FLASH_BADGE_TIMEOUT = 3000; // ms

async function flashBadge(type) {
  switch (type) {
    case 'success':
      await chrome.action.setBadgeText({ text: TEXT_OK });
      await chrome.action.setBadgeBackgroundColor({ color: COLOR_GREEN });
      break;
    case 'fail':
      await chrome.action.setBadgeText({ text: TEXT_ERROR });
      await chrome.action.setBadgeBackgroundColor({ color: COLOR_RED });
      break;
    default:
      return; // don't know what it is. quit.
  }

  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: TEXT_EMPTY });
    await chrome.action.setBadgeBackgroundColor({ color: COLOR_OPAQUE });
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
    await flashBadge('fail');
  }
});

// listen to keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const text = await BrowserAsMarkdown.handleExport(command);
    const tab = await chrome.tabs.getCurrent();

    // Insert content script to run 'copy' command
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copy,
      args: [text],
    });

    await flashBadge('success');
  } catch (e) {
    await flashBadge('fail');
  }
});

// listen to messages from popup (should be 'badge' only)
chrome.runtime.onMessage.addListener(async (message) => {
  switch (message.topic) {
    case 'badge': {
      await flashBadge(message.params.type);
      break;
    }

    default: {
      throw TypeError(`Unknown message topic '${message.topic}'`);
    }
  }

  // To avoid an error related to port closed before response
  return true;
});
