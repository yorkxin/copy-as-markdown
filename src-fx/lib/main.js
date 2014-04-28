var SDK = {
  UI: {
    Button: {
      Action: require('sdk/ui/button/action')
    }
  },
  Tabs: require("sdk/tabs"),
  Windows: require("sdk/windows"),
  Clipboard: require("sdk/clipboard"),
  ContextMenu: require("sdk/context-menu")
};

var CopyAsMarkdown = require('copy-as-markdown');

var copyToClipboard = function(string) {
  SDK.Clipboard.set(string, "text");
};

var copyAllTabsAsMarkdown = function(state) {
  var currentWindow = SDK.Windows.browserWindows.activeWindow;
  var tabs = currentWindow.tabs;

  var formattedTabs = new Array(tabs.length);

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    formattedTabs[i] = CopyAsMarkdown.formatLink(tab.url, tab.title);
  }

  var string = CopyAsMarkdown.formatList(formattedTabs);

  copyToClipboard(string);
};

// bootstrap
var button = SDK.UI.Button.Action.ActionButton({
  id: "copy-as-markdown",
  label: "Copy as Markdown (All Tabs)",
  icon: {
    "16": "./images/icon-16.png",
    "32": "./images/icon-32.png",
    "64": "./images/icon-64.png"
  },
  onClick: copyAllTabsAsMarkdown
});

var anyContext = SDK.ContextMenu.PredicateContext(function() {
  return true;
});

var contextMenu = SDK.ContextMenu.Menu({
  label: "Copy as Markdown",
  context: anyContext,
  // TODO: don't know how to specify a correct image url. This isn't working:
  // image: "./images/icon-16.png"
});

// context menu actions for page itself
var copyCurrentPageAsMarkdownMenuItem = SDK.ContextMenu.Item({
  label: "[Page Title](url)",
  data: "copyCurrentPageAsMarkdown",
  parentMenu: contextMenu,
  context: anyContext,
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ node: node, data: data, url: window.location.href, title: document.title });' +
                  '});',
  onMessage: function(message) {
    copyToClipboard(CopyAsMarkdown.formatLink(message.url, message.title));
  }
});

// context menu for a link
var copyLinkAsMarkdownMenuItem = SDK.ContextMenu.Item({
  label: "[Link Title](url)",
  data: "copyLinkAsMarkdownMenuItem",
  parentMenu: contextMenu,
  context: SDK.ContextMenu.SelectorContext("a"),
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ node: node, data: data, url: node.href, title: node.textContent });' +
                  '});',
  onMessage: function(message) {
    copyToClipboard(CopyAsMarkdown.formatLink(message.url, message.title));
  }
});
