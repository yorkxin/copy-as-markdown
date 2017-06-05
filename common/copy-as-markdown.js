import Options from "options";
import Markdown from "markdown";
import flashBadge from "badge";

var resultContainer = document.getElementById("result-markdown");
var globalOptions = {};

function copyToClipboard(text, okCallback) {
  resultContainer.value = text;
  resultContainer.select();
  document.execCommand('Copy');
  resultContainer.value = "";

  okCallback();
}

function extractTabsList(tabs) {
  let links = [];

  for (let i in tabs) {
    let tab = tabs[i];
    links.push({
      title: tab.title,
      url: tab.url
    });
  }

  return links;
}

// load options
Options.load(function(newOptions) {
  globalOptions = newOptions;
});

Options.onChange(function(changes) {
  for (let key in changes) {
    globalOptions[key] = changes[key];
  }
});

var CopyAsMarkdown = new (function() {
  this.copyLink = function(title, url, options) {
    var options = options || { needEscape: true };
    var escape = (options.needEscape && globalOptions.escape);
    var text = Markdown.linkTo(title, url, { escape });

    copyToClipboard(text, function() {
      flashBadge("success", "1");
    });
  };

  this.copyListOfLinks = function(links, options) {
    var options = options || { needEscape: true };
    var escape = (options.needEscape && globalOptions.escape);
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
    let query = {
      windowId: chrome.windows.WINDOW_ID_CURRENT,
      active: true
    };

    chrome.tabs.query(query, function(tabs) {
      tab = tabs[0];

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyLink(tab.title, tab.url, options);
    });
  };

  this.copyAllTabs = function(options) {
    let query = { currentWindow: true };

    chrome.tabs.query(query, function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
    });
  };

  this.copyHighlightedTabs = function(options) {
    let query = { currentWindow: true, highlighted: true };

    chrome.tabs.query(query, function(tabs) {
      var links = extractTabsList(tabs);

      // XXX: Bad namespacing! (CoffeeScript's binding can resolve this issue)
      CopyAsMarkdown.copyListOfLinks(links, options);
    });
  };
})();

export default CopyAsMarkdown;
