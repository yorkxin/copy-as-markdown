var SDK = {
  UI: {
    Button: {
      Action: require('sdk/ui/button/action')
    }
  },
  Tabs: require("sdk/tabs"),
  Windows: require("sdk/windows"),
  Clipboard: require("sdk/clipboard")
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
