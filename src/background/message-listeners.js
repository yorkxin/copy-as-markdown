import messageHandler from './lib/message-handler.js'

chrome.runtime.onInstalled.addListener(() => {
  // listen to keyboard shortcuts
  chrome.commands.onCommand.addListener(messageHandler);

  // listen to messages from popup
  chrome.runtime.onMessage.addListener(messageHandler);
});
