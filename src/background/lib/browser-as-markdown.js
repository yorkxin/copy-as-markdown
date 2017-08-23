// Convert browser items (tabs / window / etc.) to Markdown
import Markdown from "./markdown.js";

export function currentTab(options = {}) {
  return browser.tabs.query({ currentWindow: true, active: true })
    .then(tabs => Markdown.linkTo(tabs[0].title, tabs[0].url, options))
}

export function allTabs(options = {}) {
  return browser.tabs.query({ currentWindow: true })
    .then(tabs => Markdown.links(tabs, options))
}

export function highlightedTabs(options = {}) {
  return browser.tabs.query({ currentWindow: true, highlighted: true })
    .then(tabs => Markdown.links(tabs, options))
}

export default {
  currentTab,
  allTabs,
  highlightedTabs
}
