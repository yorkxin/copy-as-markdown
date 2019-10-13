import * as Markdown from './markdown.js';
import copy from './clipboard-access.js';
import { flashSuccessBadge } from './badge.js';

function tabAsMarkdown(tab) {
  return Markdown.linkTo(tab.title, tab.url);
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

export default async function contextMenuHandler(info, tab) {
  let markdown;

  switch (info.menuItemId) {
    case 'current-page': {
      markdown = tabAsMarkdown(tab);
      break;
    }

    case 'link': {
      markdown = linkAsMarkdown(info);
      break;
    }

    case 'image': {
      markdown = imageAsMarkdown(info);
      break;
    }

    default: {
      throw new TypeError(`unknown context menu: ${info}`);
    }
  }

  await copy(markdown);
  await flashSuccessBadge();
}
