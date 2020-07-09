import * as Markdown from './markdown.js';
import copy from './clipboard-access.js';
import flashBadge from './badge.js';

async function tabAsMarkdown(info, tab) {
  let { title } = tab;

  if (!title) {
    // Firefox does not grant activeTab automatically. Find current tab from tabs API instead.
    title = await new Promise((resolve, reject) => {
      chrome.tabs.getCurrent((currentTab) => {
        if (currentTab) {
          resolve(currentTab.title);
        } else {
          reject(new Error('Could not retrieve current tab'));
        }
      });
    });
  }

  return Markdown.linkTo(title, info.pageUrl);
}

function linkAsMarkdown(info) {
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

function imageAsMarkdown(info) {
  return Markdown.imageFor('', info.srcUrl);
}

async function dispatchGetMarkdownCode(info, tab) {
  switch (info.menuItemId) {
    case 'current-page': {
      return tabAsMarkdown(info, tab);
    }

    case 'link': {
      return linkAsMarkdown(info);
    }

    case 'image': {
      return imageAsMarkdown(info);
    }

    default: {
      throw new TypeError(`unknown context menu: ${info}`);
    }
  }
}

export default async function contextMenuHandler(info, tab) {
  try {
    const markdown = await dispatchGetMarkdownCode(info, tab);
    await copy(markdown);
    await flashBadge('success');
  } catch (error) {
    console.error(error);
    await flashBadge('fail');
  }
}
