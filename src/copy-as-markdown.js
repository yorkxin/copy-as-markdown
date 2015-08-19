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
      currentWindow: true,
    }, callback);
  };

  var getHighlightedTabsOfCurrentWindow = function (callback) {
    chrome.tabs.query({
      currentWindow: true,
      highlighted: true
    }, callback);
  };

  var defaultTitle = "(No Title)";

  var copyToClipboard = function(text, okCallback) {
    resultContainer.value = text;
    resultContainer.select();
    document.execCommand('Copy');
    resultContainer.value = "";

    okCallback();
  };

  this.getDefaultTitle = function() {
    return defaultTitle;
  };

  this.copySelection = function(html) {
    copyToClipboard(Markdown.fromHtml(html), function() {
      flashBadge("success", "1");
    });
  }

  this.copyLink = function(title, url, options) {
    copyToClipboard(Markdown.linkTo(title, url, options), function() {
      flashBadge("success", "1");
    });
  };

  this.copyListOfLinks = function(links, options) {
    var md_list = [];
    for(var i in links) {
      var md = Markdown.linkTo(links[i].title, links[i].url, options);
      md_list.push("* " + md);
    }

    copyToClipboard(md_list.join("\n"), function() {
      flashBadge("success", md_list.length.toString());
    });
  };

  this.copyImage = function(title, url) {
    copyToClipboard(Markdown.imageFor(title, url), function() {
      flashBadge("success", "1");
    });
  };

  this.copyCurrentTab = function(options, callback) {
    getCurrentTab(function(tab) {
      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLink(tab.title, tab.url, options);
      callback();
    });
  };

  var extractTabsList = function(tabs) {
    var links = [];

    for (var i in tabs) {
      var tab = tabs[i];
      links.push({
        title: tab.title,
        url: tab.url
      });
    }

    return links;
  };

  this.copyAllTabs = function(options, callback) {
    getAllTabsOfCurrentWindow(function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
      callback();
    });
  };

  this.copyHighlightedTabs = function(options, callback) {
    getHighlightedTabsOfCurrentWindow(function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
      callback();
    });
  };

  var flashBadge = function(type, text) {
    var color;

    switch (type) {
      case "success":
        color = "#738a05";
        break;
      case "fail":
        color = "#d11b24";
        text = "!";
        break;
      default:
        return; // don't know what it is. quit.
    }

    chrome.browserAction.setBadgeText({
      "text": text
    });

    chrome.browserAction.setBadgeBackgroundColor({
      "color": color
    });

    setTimeout(clearBadge, 3000);
  };

  var clearBadge = function(type, text) {
    chrome.browserAction.setBadgeText({
      text: ""
    });

    chrome.browserAction.setBadgeBackgroundColor({
      color: [0, 0, 0, 255] // opaque
    });
  };
})();

