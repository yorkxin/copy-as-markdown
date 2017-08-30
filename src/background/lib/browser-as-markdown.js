// Convert browser items (tabs / window / etc.) to Markdown
import Markdown from "./markdown.js";

export function currentTab(options = {}) {
  return browser.tabs.query({ currentWindow: true, active: true })
    .then(tabs => Markdown.linkTo(tabs[0].title, tabs[0].url, options))
}

export function allTabs(contentType, options = {}) {
  return browser.tabs.query({ currentWindow: true })
    .then(tabs => tabsToResult[contentType](tabs, options))
}

export function highlightedTabs(contentType, options = {}) {
  return browser.tabs.query({ currentWindow: true, highlighted: true })
    .then(tabs => tabsToResult[contentType](tabs, options))
}

let tabsToResult = {
  link: (tabs, options) => Markdown.links(tabs, options),
  title: (tabs /*, options */) => Markdown.list(tabs.map(tab => tab.title)),
  url: (tabs /*, options */) => Markdown.list(tabs.map(tab => tab.url)),
}

export default {
  currentTab,
  allTabs,
  highlightedTabs
}
