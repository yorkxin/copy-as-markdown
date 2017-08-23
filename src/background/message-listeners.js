import messageHandler from './lib/message-handler.js'

browser.runtime.onInstalled.addListener(() => {
  // listen to keyboard shortcuts
  browser.commands.onCommand.addListener(messageHandler);

  // listen to messages from popup
  browser.runtime.onMessage.addListener(messageHandler);
});
