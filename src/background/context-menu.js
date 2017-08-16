import Markdown from "markdown.js";
import flashBadge from "badge.js";

function copyToClipboard(text, tab) {
  browser.tabs.executeScript(tab.id, {
    file: "/content-script.dist.js"
  }).then(() => {
    return browser.tabs.sendMessage(tab.id, { text });
  });
}

function handler(info, tab) {
  switch (info.menuItemId) {
    case "current-page": {
      let response = Markdown.linkTo(tab.title, tab.url);
      copyToClipboard(response.markdown, tab)
        .then(() => flashBadge("success", response.size));
      break;
    }

    case "link": {
      // auto discover image
      let linkText = "";
      let needEscape = true;

      if (info.mediaType === "image") {
        needEscape = false;
        linkText = Markdown.imageFor("", info.srcUrl);
      } else {
        linkText = info.selectionText;
      }

      let response = Markdown.linkTo(linkText, info.linkUrl, needEscape);
      copyToClipboard(response.markdown, tab)
        .then(() => flashBadge("success", response.size));
      break;
    }

    case "image": {
      let response = Markdown.imageFor("", info.srcUrl);
      copyToClipboard(response.markdown, tab)
        .then(() => flashBadge("success", response.size));
      break;
    }
  }
}

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
