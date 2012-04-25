var copyAsMarkdownContextMenuId = chrome.contextMenus.create({
  title: "Copy as Markdown",
  type: "normal",
  contexts: ["page", "link", "image"]
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Page [title](url)",
  type: "normal",
  contexts: ["page"],
  onclick: function copyPageAsMarkdownCallback(info, tab) {
    CopyAsMarkdown.copyLinkAsMarkdown(tab.title, tab.url, {use_identifier: false});
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Page [title][id]",
  type: "normal",
  contexts: ["page"],
  onclick: function copyPageAsMarkdownCallback(info, tab) {
    CopyAsMarkdown.copyLinkAsMarkdown(tab.title, tab.url, {use_identifier: true});
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Link [text or img](url)",
  type: "normal",
  contexts: ["link"],
  onclick: function copyPageAsMarkdownCallback(info, tab) {
    // auto discover image
    var linkText = "";

    if (info.mediaType === "image") {
      linkText = "![]("+info.srcUrl+")";
    } else {
      linkText = info.selectionText;
    }
    CopyAsMarkdown.copyLinkAsMarkdown(linkText, info.linkUrl, {use_identifier: false});
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Link [text or img][id]",
  type: "normal",
  contexts: ["link"],
  onclick: function copyPageAsMarkdownCallback(info, tab) {
    // auto discover image
    var linkText = "";

    if (info.mediaType === "image") {
      linkText = "![]("+info.srcUrl+")";
    } else {
      linkText = info.selectionText;
    }

    CopyAsMarkdown.copyLinkAsMarkdown(linkText, info.linkUrl, {use_identifier: true});
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Image ![](src)", // TODO: how to fetch alt text?
  type: "normal",
  contexts: ["image"],
  onclick: function copyImageAsMarkdownCallback(info, tab) {
    CopyAsMarkdown.copyImageAsMarkdown("", info.srcUrl);
  }
});
