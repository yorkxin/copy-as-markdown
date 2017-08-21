// Polyfilled clipboard access
//
// For browsers supporting background page copy (Chrome), use `copyByBackgroundPage()`
// For browsers don't support it (Firefox), use `copyByContentScript()`
//
import BackgroundClipboard from "./background-clipboard.js"
import flashBadge from "./badge.js";
import aBrowser from "../../lib/async-browser.js"

let canCopyInBackground = false;
let backgroundClipboard = new BackgroundClipboard(document.body)

function copyByContentScript(text, tab) {
  return aBrowser.tabs.executeScript(tab.id, { file: "/content-script.dist.js" })
    .then(() => aBrowser.tabs.sendMessage(tab.id, { text }));
}

function copyByBackgroundPage(text) {
  return backgroundClipboard.set(text)
}

// test if we can do copy in background
backgroundClipboard.set("test")
  .then(() => canCopyInBackground = true)
  .catch(() => canCopyInBackground = false)

export function copyText(text, tab) {
  if (canCopyInBackground) {
    return copyByBackgroundPage(text)
  } else if (!tab) {
    return aBrowser.tabs.getCurrent()
      .then(tab => copyByContentScript(text, tab))
  } else {
    return copyByContentScript(text, tab)
  }
}

/**
 *
 * @param {MarkdownResponse} response generated from markdown.js
 * @param {chrome.tabs.tab | null} tab Tab in which the copy was called from. Default to `null` = use `currentTab()`.
 * @return {Promise}
 */
export function copyMarkdownResponse(response, tab) {
  tab = tab || null;
  return copyText(response.markdown, tab)
    .then(() => flashBadge("success", response.size));
}
