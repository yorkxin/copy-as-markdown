import messageHandler from './lib/message-handler.js'

browser.runtime.onInstalled.addListener(() => {
  // listen to keyboard shortcuts
  browser.commands.onCommand.addListener(command => {
    return messageHandler({ action: command })
  });

  // listen to messages from popup
  browser.runtime.onMessage.addListener(payload => {
    // payload: { action, executeCopy }
    return messageHandler(payload)
  })
});
