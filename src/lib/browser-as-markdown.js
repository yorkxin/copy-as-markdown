// Convert browser items (tabs / window / etc.) to Markdown
import * as Markdown from './markdown.js';

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
      const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
      const onlyOneTab = tabs[0];
      return Markdown.linkTo(onlyOneTab.title, onlyOneTab.url);
    }

    case 'all-tabs-link-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return Markdown.links(tabs, {});
    }

    case 'all-tabs-title-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return Markdown.list(tabs.map((tab) => tab.title));
    }

    case 'all-tabs-url-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return Markdown.list(tabs.map((tab) => tab.url));
    }

    case 'highlighted-tabs-link-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
      return Markdown.links(tabs, {});
    }

    case 'highlighted-tabs-title-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
      return Markdown.list(tabs.map((tab) => tab.title));
    }

    case 'highlighted-tabs-url-as-list': {
      const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
      return Markdown.list(tabs.map((tab) => tab.url));
    }

    default: {
      throw new TypeError(`Unknown action: ${action}`);
    }
  }
}
