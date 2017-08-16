import handleMessage from "./handle-message.js";

chrome.runtime.onInstalled.addListener(function() {
  chrome.runtime.onMessage.addListener(function(action/*, sender, sendResponse */) {
    handleMessage(action);
  });
});
