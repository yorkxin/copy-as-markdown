import Markdown from "./lib/markdown.js";
import { copyMarkdownResponse } from "./lib/clipboard-access.js"

function handler(info, tab) {
  switch (info.menuItemId) {
    case "current-page": {
      let response = Markdown.linkTo(tab.title, tab.url);
      return copyMarkdownResponse(response, tab)
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
        linkText = info.selectionText;
      }

      let response = Markdown.linkTo(linkText, info.linkUrl, { needEscape });
      return copyMarkdownResponse(response, tab)
    }

    case "image": {
      let response = Markdown.imageFor("", info.srcUrl);
      return copyMarkdownResponse(response, tab)
    }
  }
}

browser.runtime.onInstalled.addListener(function() {
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
});