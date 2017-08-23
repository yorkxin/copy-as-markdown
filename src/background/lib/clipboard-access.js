// Polyfilled clipboard access
//
// For browsers supporting background page copy (Chrome), use `copyByBackgroundPage()`
// For browsers don't support it (Firefox), use `copyByContentScript()`
//
import BackgroundClipboard from "./background-clipboard.js"
import flashBadge from "./badge.js";
import ENVIRONMENT from "environment";

let backgroundClipboard = new BackgroundClipboard(document.body)

function copyByBackgroundPage(text) {
  return backgroundClipboard.set(text)
}

function copyByContentScript(text, tab) {
  return browser.tabs.executeScript(tab.id, { file: "/content-script/clipboard.js" })
    .then(() => browser.tabs.sendMessage(tab.id, { text }))
}

function copyByContentScriptWithTabWrapping(text, tab) {
  if (!tab) {
    return browser.tabs.getCurrent()
      .then(tab => copyByContentScript(text, tab))
  } else {
    return copyByContentScript(text, tab)
  }
}

let copyText = null;

if (ENVIRONMENT.CAN_COPY_IN_BACKGROUND) {
  copyText = copyByBackgroundPage
} else {
  copyText = copyByContentScriptWithTabWrapping
}

/**
 *
 * @param {MarkdownResponse} response generated from markdown.js
 * @param {browser.tabs.tab} [tab=null] Tab in which the copy was called from. Default to `null` = use `currentTab()`.
 * @return {Promise}
 */
export function copyMarkdownResponse(response, tab = null) {
  return copyText(response.markdown, tab)
    .then(() => flashBadge("success", response.size));
}
