import contextMenuHandler from './context-menus.js';
import messageHandler from './lib/message-handler.js';
import { flashSuccessBadge } from '../lib/badge.js';

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
});
