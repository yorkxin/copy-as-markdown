const ESCAPE_CHARS = /([\\`*_\[\]#])/g;

var escapeLinkText = function(text) {
  return text.replace(ESCAPE_CHARS, "\\$1");
};

var Markdown = {
  linkTo: function(title, url) {
    if (title === undefined) {
      title = CopyAsMarkdown.getDefaultTitle();
    } else {
      title = escapeLinkText(title);
    }

    var result = "[" + title + "](" + url + ")";

    return result;
  },
  imageFor: function(title, url) {
    return "!["+title+"]("+url+")";
  }
};
