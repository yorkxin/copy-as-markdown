// Convert browser items (tabs / window / etc.) to Markdown
import * as Markdown from './markdown.js';

const tabsToResult = {
  link: (tabs, options) => Markdown.links(tabs, options),
  title: (tabs /* , options */) => Markdown.list(tabs.map((tab) => tab.title)),
  url: (tabs /* , options */) => Markdown.list(tabs.map((tab) => tab.url)),
};

/**
 * @param {chrome.tabs.QueryInfo} query
 */
function queryTabs(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}

export async function currentTab(options = {}) {
  const tabs = await queryTabs({ currentWindow: true, active: true });
  const onlyOneTab = tabs[0];
  return Markdown.linkTo(onlyOneTab.title, onlyOneTab.url, options);
}

export async function allTabs(contentType, options = {}) {
  const tabs = await queryTabs({ currentWindow: true });
  return tabsToResult[contentType](tabs, options);
}

export async function highlightedTabs(contentType, options = {}) {
  const tabs = await queryTabs({ currentWindow: true, highlighted: true });
  return tabsToResult[contentType](tabs, options);
}
