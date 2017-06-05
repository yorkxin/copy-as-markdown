import Options from "options";
import Markdown from "markdown";
import flashBadge from "badge";
import Clipboard from "clipboard";

var globalOptions = {};
var clipboard = new Clipboard(document.body);

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

export function copyLink(title, url, options) {
  var options = options || { needEscape: true };
  var escape = (options.needEscape && globalOptions.escape);
  var text = Markdown.linkTo(title, url, escape);

  clipboard.set(text)
    .then(function() {
      flashBadge("success", "1");
    });
}

export function copyListOfLinks(links, options) {
  var options = options || { needEscape: true };
  var escape = (options.needEscape && globalOptions.escape);

  clipboard.set(Markdown.list(links, escape))
    .then(function() {
      flashBadge("success", links.length.toString());
    });
}

export function copyImage(title, url) {
  clipboard.set(Markdown.imageFor(title, url))
    .then(function() {
      flashBadge("success", "1");
    });
}

export function copyCurrentTab(options) {
  let query = {
    windowId: chrome.windows.WINDOW_ID_CURRENT,
    active: true
  };

  chrome.tabs.query(query, function(tabs) {
    let tab = tabs[0];

    copyLink(tab.title, tab.url, options);
  });
}

export function copyAllTabs(options) {
  let query = { currentWindow: true };

  chrome.tabs.query(query, function(tabs) {
    var links = extractTabsList(tabs);

    copyListOfLinks(links, options);
  });
}

export function copyHighlightedTabs(options) {
  let query = { currentWindow: true, highlighted: true };

  chrome.tabs.query(query, function(tabs) {
    var links = extractTabsList(tabs);

    copyListOfLinks(links, options);
  });
}

export default {
  copyLink,
  copyListOfLinks,
  copyImage,
  copyCurrentTab,
  copyAllTabs,
  copyHighlightedTabs
};
