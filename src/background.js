import contextMenuHandler from './background/context-menus.js';
import messageHandler from './background/message-handler.js';
import flashBadge from './background/badge.js';

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

chrome.contextMenus.onClicked.addListener(contextMenuHandler);

// listen to keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  await messageHandler({
    topic: 'copy',
    params: {
      action: command,
    },
  });

  await flashBadge('success');
});

// listen to messages from popup
chrome.runtime.onMessage.addListener(async (message) => {
  await messageHandler(message);

  // To avoid an error related to port closed before response
  return true;
});
