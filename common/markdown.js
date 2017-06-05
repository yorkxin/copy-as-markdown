const ESCAPE_CHARS = /([\\`*_\[\]<>])/g;
const DEFAULT_TITLE = "(No Title)";

var escapeLinkText = function(text) {
  return text.replace(ESCAPE_CHARS, "\\$1");
};

var Markdown = {
  linkTo: function(title, url, options) {
    options = options || {};

    // used for copying link-in-image
    if (options.escape !== true) {
      options.escape = false;
    }

    if (title === undefined) {
      title = DEFAULT_TITLE;
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

export default Markdown;
