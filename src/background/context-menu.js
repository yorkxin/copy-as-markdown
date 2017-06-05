import CopyAsMarkdown from "copy-as-markdown";
import Markdown from "markdown";

function handler(info, tab) {
  switch (info.menuItemId) {
    case "current-page":
      CopyAsMarkdown.copyLink(tab.title, tab.url);
      break;

    case "link":
      // auto discover image
      let linkText = "";
      let needEscape = true;

      if (info.mediaType === "image") {
        needEscape = false;
        linkText = Markdown.imageFor("", info.srcUrl);
      } else {
        linkText = info.selectionText;
      }

      CopyAsMarkdown.copyLink(linkText, info.linkUrl, needEscape);
      break;

    case "image":
      CopyAsMarkdown.copyImage("", info.srcUrl);
      break;
  }
};

chrome.runtime.onInstalled.addListener(function() {
  let parentID = chrome.contextMenus.create({
    id: "parent",
    title: "Copy as Markdown",
    type: "normal",
    contexts: ["page", "link", "image"]
  });

  chrome.contextMenus.create({
    id: "current-page",
    parentId: parentID,
    title: "Page [title](url)",
    type: "normal",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "link",
    parentId: parentID,
    title: "Link [text or img](url)",
    type: "normal",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "image",
    parentId: parentID,
    title: "Image ![](src)", // TODO: how to fetch alt text?
    type: "normal",
    contexts: ["image"]
  });

  chrome.contextMenus.onClicked.addListener(handler);
});
