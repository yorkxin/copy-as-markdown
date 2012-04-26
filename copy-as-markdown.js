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

  var copyToClipboard = function(text) {
    resultContainer.value = text;
    resultContainer.select();
    document.execCommand('Copy');
    resultContainer.value = "";
  };

  this.copyLink = function(title, url, options) {
    copyToClipboard(Markdown.linkTo(title, url, options));
  };

  this.copyListOfLinks = function(links, options) {
    var md_list = [];
    for(var i in links) {
      var md = Markdown.linkTo(links[i].title, links[i].url, options);
      md_list.push("* " + md);
    }

    copyToClipboard(md_list.join("\n"));
  };

  this.copyImage = function(title, url) {
    copyToClipboard(Markdown.imageFor(title, url));
  };

  this.copyCurrentTab = function(options, callback) {
    getCurrentTab(function(tab) {
      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLink(tab.title, tab.url, options);
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
      CopyAsMarkdown.copyListOfLinks(links, options);
      callback();
    });
  };
})();

