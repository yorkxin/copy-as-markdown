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
    var needEscape = true;
    var contextInfo = {};

    chrome.tabs.sendMessage(tab.id, "getContextInfo", function(result) {
      contextInfo.data = result;
      console.log('contextMenu.onclick: info, tab, contextInfo', info, tab, contextInfo);

      // TODO: If image has no text, but is wrapped in an HREF, then we might
      //       get a description from there.
      // TODO: Err, this should probably also be in the next section which handles
      //       images!
      if (info.mediaType === "image") {
        needEscape = false;
        linkText = "![]("+info.srcUrl+")";
        // linkText = "![" + (contextInfo.data.alt || "") + "](" + contextInfo.data.src + ")";
        linkText = contextInfo.data.alt || "";
      } else {
        linkText = info.selectionText ||
          (contextInfo.data.innerText || "");
        // Trust the link passed back, since it will recurse to find
        // a link if necessary
        info.linkUrl = contextInfo.data.href || info.linkUrl;
      }
      // Not sure how this will handle a link pre-provided in the linkText
      CopyAsMarkdown.copyLink(linkText, info.linkUrl, { needEscape });
    });

  }
});

chrome.contextMenus.create({
  parentId: copyAsMarkdownContextMenuId,
  title: "Image ![](src)", // TODO: how to fetch alt text?
                           // XXX: just ask sfinktah!
  // Using this test page: http://bl.ocks.org/mbostock/3680958 (and the image in the top left)
  // we can see the following results from our console.logs in the content javascript:
  // 
  // sfinktah: received right-click for ![null](https://avatars.githubusercontent.com/u/230541?v=3&s=60)
  // sfinktah: received right-click for [Mike Bostock](http://bl.ocks.org/mbostock)
  //
  // Evidentally there was no ALT text for that image, but this is also a limited case of there being
  // a wrapping HREF that also contains inner text, that we can use as a description.
  //
  // Copy the above code and decide on what logic to employee (is ALT more important than LINK TEXT?)
  type: "normal",
  contexts: ["image"],
  onclick: function (info, tab) {
    CopyAsMarkdown.copyImage("", info.srcUrl);
  }
});
