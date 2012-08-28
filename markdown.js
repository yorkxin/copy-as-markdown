var Markdown = {
  linkTo: function(title, url, options) {
    if (options === undefined) {
      options = { use_identifier: false };
    }

    if (title === undefined) {
      title = CopyAsMarkdown.getDefaultTitle();
    }

    var result = "";
    if (options.use_identifier === true) {
      result = "[" + title + "][id]\n\n[id]: " + url;
    } else {
      result = "[" + title + "](" + url + ")";
    }

    return result;
  },
  imageFor: function(title, url) {
    return "!["+title+"]("+url+")";
  }
};