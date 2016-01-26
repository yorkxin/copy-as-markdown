var SDK = {
  Clipboard: require("sdk/clipboard"),
  SimplePrefs: require("sdk/simple-prefs")
};

var Markdown = require("./markdown");

var preferences = SDK.SimplePrefs.prefs;

var copyToClipboard = function(string) {
  SDK.Clipboard.set(string, "text");
};

exports.link = function(url, title, options={ needEscape: true }) {
  title = title || url;

  var escape = options.needEscape && preferences.escape;

  var string = Markdown.formatLink(url, title, { escape });

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
  var escape = preferences.escape;

  var formattedTabs = new Array(tabs.length);

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    formattedTabs[i] = Markdown.formatLink(tab.url, tab.title, { escape });
  }

  var string = Markdown.formatList(formattedTabs);

  copyToClipboard(string);
};
