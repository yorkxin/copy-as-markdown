const ESCAPE_CHARS = /([\\`*_\[\]<>])/g;

var escapeLinkText = function(text) {
  return text.replace(ESCAPE_CHARS, "\\$1");
};

var Markdown = {
  linkTo: function(title, url, options) {
    options = options || {};

    // used for copying link-in-image
    if (options.escape !== false) {
      options.escape = true;
    }

    if (title === undefined) {
      title = CopyAsMarkdown.getDefaultTitle();
    }

    if (options.escape) {
      title = escapeLinkText(title);
    }

    var result = "[" + title + "](" + url + ")";

    return result;
  },
  imageFor: function(title, url) {
    return "!["+title+"]("+url+")";
  }
};
