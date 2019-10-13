// Convert browser items (tabs / window / etc.) to Markdown
import * as Markdown from "./markdown.js";

export async function currentTab(options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      resolve(Markdown.linkTo(tabs[0].title, tabs[0].url, options))
    });
  });
}

export async function allTabs(contentType, options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      resolve(tabsToResult[contentType](tabs, options))
    });
  });
}

export async function highlightedTabs(contentType, options = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true, highlighted: true }, (tabs) => {
      resolve(tabsToResult[contentType](tabs, options))
    });
  });
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
