import handleMessage from "./handle-message.js";

chrome.runtime.onInstalled.addListener(function() {
  chrome.extension.onMessage.addListener(function(action, sender, sendResponse) {
    handleMessage(action);
  });
});
