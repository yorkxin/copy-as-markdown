// Convert browser items (tabs / window / etc.) to Markdown
import * as Markdown from './markdown.js';

/**
 * Async wrapper around chrome.tabs.query function.
 *
 * This is a workaround for Firefox (102), whose `chrome.tabs.query` was not properly implemented.
 * `await browser.tabs.query()` works though, but `browser` object is not compatible with Chromium.
 *
 * @param query {chrome.tabs.QueryInfo}
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
async function asyncTabsQuery(query) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(query, (tabs) => {
        if (!tabs) {
          reject(new Error(`got nil (${typeof tabs})`));
        } else {
          resolve(tabs);
        }
      });
    } catch (e) {
      reject(new Error('tabs.query failed:', { cause: e }));
    }
  });
}

/**
 *
 * @param info {chrome.contextMenus.OnClickData}
 * @returns {string}
 */
export function onClickLink(info) {
  // auto discover image
  let linkText;
  let needEscape;

  if (info.mediaType === 'image') {
    needEscape = false;
    linkText = Markdown.imageFor('', info.srcUrl);
  } else {
    needEscape = true;
    // linkText for Firefox (as of 2018/03/07)
    // selectionText for Chrome on Mac only. On Windows it does not highlight text when right-click.
    // TODO: use linkText when Chrome supports it on stable.
    linkText = info.selectionText ? info.selectionText : info.linkText;
  }

  return Markdown.linkTo(linkText, info.linkUrl, { needEscape });
}

export async function handleExport(action) {
  switch (action) {
    case 'current-tab-link': {
      const tabs = await asyncTabsQuery({ currentWindow: true, active: true });
      if (tabs.length !== 1) {
        throw new Error(`Expecting exactly 1 tab, got ${tabs.length} items.`);
      }

      const onlyOneTab = tabs[0];
      return Markdown.linkTo(onlyOneTab.title, onlyOneTab.url);
    }

    case 'all-tabs-link-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return Markdown.links(tabs, {});
    }

    case 'all-tabs-title-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return Markdown.list(tabs.map((tab) => tab.title));
    }

    case 'all-tabs-url-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true });
      return Markdown.list(tabs.map((tab) => tab.url));
    }

    case 'highlighted-tabs-link-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return Markdown.links(tabs, {});
    }

    case 'highlighted-tabs-title-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return Markdown.list(tabs.map((tab) => tab.title));
    }

    case 'highlighted-tabs-url-as-list': {
      const tabs = await asyncTabsQuery({ currentWindow: true, highlighted: true });
      return Markdown.list(tabs.map((tab) => tab.url));
    }

    default: {
      throw new TypeError(`Unknown action: ${action}`);
    }
  }
}
