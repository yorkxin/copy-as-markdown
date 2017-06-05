import handleMessage from "./handle-message.js";

chrome.runtime.onInstalled.addListener(function() {
  chrome.commands.onCommand.addListener(function(action) {
    handleMessage(action);
  });
});
