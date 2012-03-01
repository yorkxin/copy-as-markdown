(function() {
  var CopyAsMarkdown = new (function() {
    var resultContainer = document.getElementById("result-markdown");

    var defaultTitle = "(No Title)";

    var setMarkdownResult = function(text) {
      resultContainer.value = text;
    };

    var copyMarkdownCodeToClipboard = function() {
      resultContainer.select();
      document.execCommand('Copy');
    }

    var linkTo = function(title, url, options) {
      if (options === undefined) {
        options = { use_identifier: false };
      }

      if (title === undefined) {
        title = defaultTitle;
      }

      var result = "";
      if (options.use_identifier === true) {
        result = "[" + title + "][id]\n\n[id]: " + url;
      } else {
        result = "[" + title + "](" + url + ")";
      }

      return result;
    }

    var imageFor = function(title, url) {
      return "!["+title+"]("+url+")";
    }

    this.copyLinkAsMarkdown = function(title, url, options) {
      var markdown = linkTo(title, url, options);
      setMarkdownResult(markdown);
      copyMarkdownCodeToClipboard();
      return markdown;
    }

    this.copyLinksAsListMarkdown = function(links, options) {
      var md_list = [];
        for(var i in links) {
        var md = linkTo(links[i].title, links[i].url, options);
        md_list.push("* " + md);
      }

      var markdown = md_list.join("\n");
      setMarkdownResult(markdown);
      copyMarkdownCodeToClipboard(markdown);
      return markdown;
    };

    this.copyImageAsMarkdown = function(title, url) {
      var markdown = imageFor(title, url);
      setMarkdownResult(markdown);
      copyMarkdownCodeToClipboard();
    }
  })();


  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    console.log(request);
    switch(request.action) {
      case "copyLinkAsMarkdown":
        var md = CopyAsMarkdown.copyLinkAsMarkdown(request.params.title, request.params.url, request.params.options);
        sendResponse({markdown: md});
        break;
      case "copyLinksAsListMarkdown":
        var md = CopyAsMarkdown.copyLinksAsListMarkdown(request.params.links, request.params.options);
        sendResponse({markdown: md});
        break;
      default:
        sendResponse({error: "Unknown Action " + request.action });
        break;
    }
  });

  /* XXX: DIRTY WAY to make context menu work.
   * Should split these into another javascript file that manages context menus */

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
})();
