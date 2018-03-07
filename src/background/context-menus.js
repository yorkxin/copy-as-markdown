import Markdown from "./lib/markdown.js";
import { copyMarkdownResponse } from "./lib/clipboard-access.js"
import { flashSuccessBadge } from "../lib/badge.js"

function handler(info, tab) {
  let promise;

  switch (info.menuItemId) {
    case "current-page": {
      let response = Markdown.linkTo(tab.title, tab.url);
      promise = copyMarkdownResponse(response, tab)
      break;
    }

    case "link": {
      // auto discover image
      let linkText;
      let needEscape;

      if (info.mediaType === "image") {
        needEscape = false;
        linkText = Markdown.imageFor("", info.srcUrl).markdown;
      } else {
        needEscape = true;
        // linkText for Firefox (as of 2018/03/07)
        // selectionText for Chrome on Mac only. On Windows it does not highlight text when right-click.
        // TODO: use linkText when Chrome supports it on stable.
        linkText = info.selectionText ? info.selectionText : info.linkText;
      }

      let response = Markdown.linkTo(linkText, info.linkUrl, { needEscape });
      promise = copyMarkdownResponse(response, tab)
      break;
    }

    case "image": {
      let response = Markdown.imageFor("", info.srcUrl);
      promise = copyMarkdownResponse(response, tab)
      break;
    }

    default: {
      return Promise.reject(`unknown context menu: ${info}`)
    }
  }

  return promise.then(response => flashSuccessBadge(response.size))
}

let parentID = browser.contextMenus.create({
  id: "parent",
  title: "Copy as Markdown",
  type: "normal",
  contexts: ["page", "link", "image"]
});

browser.contextMenus.create({
  id: "current-page",
  parentId: parentID,
  title: "Page [title](url)",
  type: "normal",
  contexts: ["page"]
});

browser.contextMenus.create({
  id: "link",
  parentId: parentID,
  title: "Link [text or img](url)",
  type: "normal",
  contexts: ["link"]
});

browser.contextMenus.create({
  id: "image",
  parentId: parentID,
  title: "Image ![](src)", // TODO: how to fetch alt text?
  type: "normal",
  contexts: ["image"]
});

browser.contextMenus.onClicked.addListener(handler);
