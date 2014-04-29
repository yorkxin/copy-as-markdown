function chomp(string) {
  // string chomp!
  return string.replace(/^\s+/, '').replace(/\s+$/, '');
}

function removeNewlines(string) {
  // remove any new-line chars
  return string.replace("\n", '');
}

function determineTitle(title) {
  title = removeNewlines(chomp(title));

  if (title === '') {
    title = "(No Title)";
  }

  return title;
}

exports.formatLink = function(url, title) {
  return "[" + determineTitle(title) + "](" + url + ")";
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
