import Options from "options";
import Markdown from "markdown";

var CopyAsMarkdown = new (function() {
  var resultContainer = document.getElementById("result-markdown");

  // load options
  this.options = {};

  Options.load(function(options) {
    this.options = options;
  }.bind(this));

  Options.onChange(function(changes) {
    for (key in changes) {
      this.options[key] = changes[key];
    }
  }.bind(this))

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

  var copyToClipboard = function(text, okCallback) {
    resultContainer.value = text;
    resultContainer.select();
    document.execCommand('Copy');
    resultContainer.value = "";

    okCallback();
  };

  this.copyLink = function(title, url, options) {
    var options = options || { needEscape: true };
    var escape = (options.needEscape && this.options.escape);
    var text = Markdown.linkTo(title, url, { escape });

    copyToClipboard(text, function() {
      flashBadge("success", "1");
    });
  };

  this.copyListOfLinks = function(links, options) {
    var options = options || { needEscape: true };
    var escape = (options.needEscape && this.options.escape);
    var md_list = [];

    for(var i in links) {
      var md = Markdown.linkTo(links[i].title, links[i].url, { escape });
      md_list.push("* " + md);
    }

    var text = md_list.join("\n");

    copyToClipboard(text, function() {
      flashBadge("success", md_list.length.toString());
    });
  };

  this.copyImage = function(title, url) {
    copyToClipboard(Markdown.imageFor(title, url), function() {
      flashBadge("success", "1");
    });
  };

  this.copyCurrentTab = function(options) {
    getCurrentTab(function(tab) {
      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLink(tab.title, tab.url, options);
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

  this.copyAllTabs = function(options) {
    getAllTabsOfCurrentWindow(function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
    });
  };

  this.copyHighlightedTabs = function(options) {
    getHighlightedTabsOfCurrentWindow(function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
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

export default CopyAsMarkdown;
