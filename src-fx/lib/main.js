var SDK = {
  UI: {
    Button: {
      Toggle: require('sdk/ui/button/toggle')
    }
  },
  Tabs: require("sdk/tabs"),
  Windows: require("sdk/windows"),
  Panels: require("sdk/panel"),
  Self: require("sdk/self"),
  Clipboard: require("sdk/clipboard"),
  ContextMenu: require("sdk/context-menu")
};

var Markdown = require('markdown');

var copyToClipboard = function(string) {
  SDK.Clipboard.set(string, "text");
};

var copyCurrentTabAsMarkdown = function() {
  var currentWindow = SDK.Windows.browserWindows.activeWindow;
  var tab = currentWindow.tabs.activeTab;

  var string = Markdown.formatLink(tab.url, tab.title);

  copyToClipboard(string);
};

var copyAllTabsAsMarkdown = function(state) {
  var currentWindow = SDK.Windows.browserWindows.activeWindow;
  var tabs = currentWindow.tabs;

  var formattedTabs = new Array(tabs.length);

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    formattedTabs[i] = Markdown.formatLink(tab.url, tab.title);
  }

  var string = Markdown.formatList(formattedTabs);

  copyToClipboard(string);
};

var panel = SDK.Panels.Panel({
  contentURL: SDK.Self.data.url("panel.html"),
  contentStyleFile: SDK.Self.data.url("panel.css"),
  contentScriptFile: SDK.Self.data.url("panel.js"),
  onHide: handleHide
});

panel.port.on("copy", function(scope) {
  console.log(scope);

  switch (scope) {
    case "current-tab":
    copyCurrentTabAsMarkdown();
    break;

    case "all-tabs":
    copyAllTabsAsMarkdown();
    break;
  }

});

var togglePanel = function(state) {
  if (state.checked) {
    panel.show({
      position: button
    });
  }
};

// bootstrap
var button = SDK.UI.Button.Toggle.ToggleButton({
  id: "copy-as-markdown",
  label: "Copy as Markdown",
  icon: {
    "16": "./images/icon-16.png",
    "32": "./images/icon-32.png",
    "64": "./images/icon-64.png"
  },
  onChange: togglePanel
});

var handleHide = function() {
  button.state('window', { checked: false });
};

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
    copyToClipboard(Markdown.formatLink(message.url, message.title));
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
    copyToClipboard(Markdown.formatLink(message.url, message.title));
  }
});

var copyImageAsMarkdown = SDK.ContextMenu.Item({
  label: "![Image Alt](url)",
  data: "copyImageAsMarkdown",
  parentMenu: contextMenu,
  context: SDK.ContextMenu.SelectorContext("img"),
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ node: node, data: data, url: node.src, title: node.alt });' +
                  '});',
  onMessage: function(message) {
    copyToClipboard(Markdown.formatImage(message.url, message.title));
  }
});

