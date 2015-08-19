var copyAsMarkdownContextMenuId = chrome.contextMenus.create({
  title: "Copy as Markdown",
  type: "normal",
  contexts: ["page", "link", "image", "selection"]
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Page [title](url)",
  type: "normal",
  contexts: ["page"],
  onclick: function (info, tab) {
    CopyAsMarkdown.copyLink(tab.title, tab.url);
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Link [text or img](url)",
  type: "normal",
  contexts: ["link"],
  onclick: function (info, tab) {
    // auto discover image
    var linkText = "";

    if (info.mediaType === "image") {
      linkText = "![]("+info.srcUrl+")";
    } else {
      linkText = info.selectionText;
    }
    CopyAsMarkdown.copyLink(linkText, info.linkUrl);
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Image ![](src)", // TODO: how to fetch alt text?
  type: "normal",
  contexts: ["image"],
  onclick: function (info, tab) {
    CopyAsMarkdown.copyImage("", info.srcUrl);
  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Copy selection as markdown",
  type: "normal",
  contexts: ["selection"],
  onclick: function (info, tab) {
    chrome.tabs.sendRequest(tab.id, {}, function(selection) {
      if (selection !== undefined) {
        CopyAsMarkdown.copySelection(selection.html, selection.text);
      }
    });
  }
});