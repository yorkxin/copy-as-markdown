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
  ContextMenu: require("sdk/context-menu")
};

var CopyAsMarkdown = require("./lib/copy-as-markdown");

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

var panel = SDK.Panels.Panel({
  contentURL: SDK.Self.data.url("panel.html"),
  contentStyleFile: SDK.Self.data.url("panel.css"),
  contentScriptFile: SDK.Self.data.url("panel.js"),
  onHide: handleHide,
  width: 100,
  height: 56
});

panel.port.on("copy", function(scope) {
  var currentWindow = SDK.Windows.browserWindows.activeWindow;

  switch (scope) {
    case "current-tab":
      CopyAsMarkdown.tab(currentWindow.tabs.activeTab);
      break;

    case "all-tabs":
      CopyAsMarkdown.tabs(currentWindow.tabs);
      break;
  }
});

panel.port.on("close", function() {
  panel.hide();
});

var anyContext = SDK.ContextMenu.PredicateContext(function() {
  return true;
});

var contextMenu = SDK.ContextMenu.Menu({
  label: "Copy as Markdown",
  context: anyContext,
  image: SDK.Self.data.url("images/icon-16.png")
});

// context menu for a link
var copyLinkAsMarkdownMenuItem = SDK.ContextMenu.Item({
  label: "[Link Title](url)",
  data: "copyLinkAsMarkdown",
  parentMenu: contextMenu,
  context: SDK.ContextMenu.SelectorContext("a"),
  // TODO: use contentScriptFile
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ url: node.href, title: node.textContent });' +
                  '});',
  onMessage: function(message) {
    CopyAsMarkdown.link(message.url, message.title);
  }
});

var copyImageAsMarkdown = SDK.ContextMenu.Item({
  label: "![Image Alt](url)",
  data: "copyImageAsMarkdown",
  parentMenu: contextMenu,
  context: SDK.ContextMenu.SelectorContext("img"),
  // TODO: use contentScriptFile
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ url: node.src, title: node.alt });' +
                  '});',
  onMessage: function(message) {
    CopyAsMarkdown.image(message.url, message.title, { needEscape: false });
  }
});

// context menu actions for page itself
var copyCurrentPageAsMarkdownMenuItem = SDK.ContextMenu.Item({
  label: "[Page Title](url)",
  data: "copyCurrentPageAsMarkdown",
  parentMenu: contextMenu,
  context: anyContext,
  // TODO: use contentScriptFile
  contentScript:  'self.on("click", function(node, data) {' +
                  '  self.postMessage({ url: window.location.href, title: document.title });' +
                  '});',
  onMessage: function(message) {
    CopyAsMarkdown.link(message.url, message.title);
  }
});
