var CopyAsMarkdown = new (function() {
  var resultContainer = document.getElementById("result-markdown");

  var getCurrentTab = function (callback) {
    chrome.tabs.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
      active: true
    }, function(tabs) {
      callback(tabs[0]);
    });
  };

  var getAllTabsOfCurrentWindow = function (callback) {
    chrome.tabs.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    }, callback);
  };

  var defaultTitle = "(No Title)";

  var setMarkdownResult = function(text) {
    resultContainer.value = text;
  };

  var copyMarkdownCodeToClipboard = function() {
    resultContainer.select();
    document.execCommand('Copy');
  }

  this.copyLinkAsMarkdown = function(title, url, options) {
    var markdown = Markdown.linkTo(title, url, options);
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard();
  }

  this.copyLinksAsListMarkdown = function(links, options) {
    var md_list = [];
      for(var i in links) {
      var md = Markdown.linkTo(links[i].title, links[i].url, options);
      md_list.push("* " + md);
    }

    var markdown = md_list.join("\n");
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard();
  };

  this.copyImageAsMarkdown = function(title, url) {
    var markdown = Markdown.imageFor(title, url);
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard();
  }

  this.copyCurrentTab = function(options, callback) {
    getCurrentTab(function(tab) {
      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLinkAsMarkdown(tab.title, tab.url, options);
      callback();
    });
  };

  this.copyAllTabs = function(options, callback) {
    getAllTabsOfCurrentWindow(function(tabs) {
      var links = [];
      for (var i in tabs) {
        var tab = tabs[i];
        links.push({
          title: tab.title,
          url: tab.url
        });
      };

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLinksAsListMarkdown(links, options);
      callback();
    });
  };
})();

