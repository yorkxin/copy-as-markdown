const ESCAPE_CHARS = /([\\`*_\[\]<>])/g;

function chomp(string) {
  // string chomp!
  return string.replace(/^\s+/, '').replace(/\s+$/, '');
}

function removeNewlines(string) {
  // remove any new-line chars
  return string.replace("\n", '');
}

function escapeLinkText(string) {
  return string.replace(ESCAPE_CHARS, "\\$1");
}

function determineTitle(title, options={ escape: true }) {
  title = removeNewlines(chomp(title));

  if (options.escape) {
    title = escapeLinkText(title);
  }

  if (title === '') {
    title = "(No Title)";
  }

  return title;
}

exports.formatLink = function(url, title, options={ escape: true }) {
  return "[" + determineTitle(title, options) + "](" + url + ")";
};

exports.formatImage = function(url, title) {
  return "![" + determineTitle(title) + "](" + url + ")";
};

exports.formatList = function(texts) {
  // new line chars are appended at the end of each line
  // to make sure that we'll have a new line char at the very end.
  return texts.map(function(text) {
    return "- " + text + "\n";
  }).join("");
};
