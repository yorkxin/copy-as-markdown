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
      var converter = [
        {
          filter: 'span',
          replacement: function (innerHTML) {
            return innerHTML;
          }
        },
        {
          filter: 'div',
          replacement: function (content) {
            return '\n\n' + content + '\n\n';
          }
        },
        {
          filter: function (node) {
            return node.nodeName === 'PRE' && node.firstChild.nodeName !== 'CODE';
          },
          replacement: function(content) {
            return '\n\n    ' + content.replace(/\n/g, '\n    ') + '\n\n';
          }
        },
        {
          filter: ['section', 'small', 'font'],
          replacement: function (content) {
            return content;
          }
        },
        {
          filter: ['iframe', 'javascript', 'script'],
          replacement: function (content) {
            return '';
          }
        }
      ];
      return toMarkdown(html, { gfm: true, converters: converter });
    }
  }
};