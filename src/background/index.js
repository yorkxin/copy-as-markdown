import contextMenuHandler from './context-menus.js';
import messageHandler from './message-handler.js';
import { flashSuccessBadge } from './badge.js';

// Always create context menus when running background page.
// Since we don't use event page, this will presumably executed every time
// the extension is loaded (once).
//
// NOTE: The examples shows that you need to use chrome.runtime.onInstalled,
// but that's for non-persistent event page, not for persistent background page.
// That example was used to prevent duplicate menu items.
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

// NOTE: All listeners must be registered at top level scope.

chrome.contextMenus.onClicked.addListener(contextMenuHandler);

// listen to keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  await messageHandler({
    topic: 'copy',
    params: {
      action: command,
    },
  });

  flashSuccessBadge();
});

// listen to messages from popup
chrome.runtime.onMessage.addListener(async (message) => {
  await messageHandler(message);

  // To avoid an error related to port closed before response
  return true;
});
