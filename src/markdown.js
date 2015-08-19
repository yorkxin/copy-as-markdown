var Markdown = {
  linkTo: function(title, url) {
    if (title === undefined) {
      title = CopyAsMarkdown.getDefaultTitle();
    }

    var result = "[" + title + "](" + url + ")";

    return result;
  },
  imageFor: function(title, url) {
    return "!["+title+"]("+url+")";
  },
  fromHtml: function(html, text) {
    if (html === undefined) {
      return text;
    }
    else {
      return toMarkdown(html);
    }
  }
};