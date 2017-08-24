// Polyfilled clipboard access
//
// For browsers supporting background page copy (Chrome), use `copyByBackgroundPage()`
// For browsers don't support it (Firefox), use `copyByContentScript()`
//
import copyByBackground from "../../lib/clipboard.js"
import flashBadge from "./badge.js";
import ENVIRONMENT from "environment";

function copyByContentScript(text, tab) {
  return browser.tabs.executeScript(tab.id, { file: "/content-script-clipboard.dist.js" })
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
  copyText = copyByBackground
} else {
  copyText = copyByContentScriptWithTabWrapping
}

/**
 *
 * @param {MarkdownResponse} response generated from markdown.js
 * @param {browser.tabs.Tab} [tab=null] Tab in which the copy was called from. Default to `null` = use `currentTab()`.
 * @return {Promise}
 */
export function copyMarkdownResponse(response, tab = null) {
  return copyText(response.markdown, tab)
    .then(() => flashBadge("success", response.size));
}
