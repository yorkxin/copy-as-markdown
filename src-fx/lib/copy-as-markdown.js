var SDK = {
  Clipboard: require("sdk/clipboard")
};

var Markdown = require("./markdown");

var copyToClipboard = function(string) {
  SDK.Clipboard.set(string, "text");
};

exports.link = function(url, title, options={ escape: true }) {
  title = title || url;

  var string = Markdown.formatLink(url, title, options);

  copyToClipboard(string);
};

exports.image = function(url, title) {
  title = title || url;

  var string = Markdown.formatImage(url, title);

  copyToClipboard(string);
}

exports.tab = function(tab) {
  this.link(tab.url, tab.title);
};

exports.tabs = function(tabs) {
  var formattedTabs = new Array(tabs.length);

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    formattedTabs[i] = Markdown.formatLink(tab.url, tab.title);
  }

  var string = Markdown.formatList(formattedTabs);

  copyToClipboard(string);
};
