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

  var copyToClipboard = function(text) {
    resultContainer.value = text;
    resultContainer.select();
    document.execCommand('Copy');
    resultContainer.value = "";

    flashBadge("success");
  };

  this.getDefaultTitle = function() {
    return defaultTitle;
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

  this.copyImageToLocal = function (title, url) {
    user_dir = localStorage["path"].replace(/[\r\n]/, '');

    var filename = url.replace(/^.*[\\\/]/, '');
    var localPath = user_dir.concat(filename);
    copyToClipboard(Markdown.imageFor(title, localPath));

    var pathDownloadDir = user_dir.replace(/^.*[\\\/]Downloads/, '');
    var relativePath = ".".concat(pathDownloadDir).concat(filename);
    chrome.downloads.download({url: url, filename: relativePath}, function(id) {
    });
  }



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

  var flashBadge = function(type) {
    var color, text;

    switch (type) {
      case "success":
        color = "#738a05";
        text = "\u2713"; // Check mark
        break;
      case "fail":
        color = "#d11b24";
        text = "\u2717"; // Ballout XXX
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

