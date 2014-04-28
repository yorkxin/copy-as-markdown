var SDK = {
  UI: {
    Button: {
      Action: require('sdk/ui/button/action')
    }
  },
  Tabs: require("sdk/tabs")
};

var copyAllTabsAsMarkdown = function(state) {
  console.log("ok");
  // todo
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
