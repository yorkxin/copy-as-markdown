// Promisify Chrome / Chromium API
// To make it same as Firefox's browser.* API
import promisify from "es6-promisify";

let tabs = {
  getCurrent: promisify(chrome.tabs.getCurrent),
  query: promisify(chrome.tabs.query),
  executeScript: promisify(chrome.tabs.executeScript),
  sendMessage: promisify(chrome.tabs.sendMessage),
}

export default { tabs }
