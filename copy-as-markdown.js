var CopyAsMarkdown = new (function() {
  var resultContainer = document.getElementById("result-markdown");

  var defaultTitle = "(No Title)";

  var setMarkdownResult = function(text) {
    resultContainer.value = text;
  };

  var copyMarkdownCodeToClipboard = function() {
    resultContainer.select();
    document.execCommand('Copy');
  }

  var linkTo = function(title, url, options) {
    if (options === undefined) {
      options = { use_identifier: false };
    }

    if (title === undefined) {
      title = defaultTitle;
    }

    var result = "";
    if (options.use_identifier === true) {
      result = "[" + title + "][id]\n\n[id]: " + url;
    } else {
      result = "[" + title + "](" + url + ")";
    }

    return result;
  }

  var imageFor = function(title, url) {
    return "!["+title+"]("+url+")";
  }

  this.copyLinkAsMarkdown = function(title, url, options) {
    var markdown = linkTo(title, url, options);
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard();
    return markdown;
  }

  this.copyLinksAsListMarkdown = function(links, options) {
    var md_list = [];
      for(var i in links) {
      var md = linkTo(links[i].title, links[i].url, options);
      md_list.push("* " + md);
    }

    var markdown = md_list.join("\n");
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard(markdown);
    return markdown;
  };

  this.copyImageAsMarkdown = function(title, url) {
    var markdown = imageFor(title, url);
    setMarkdownResult(markdown);
    copyMarkdownCodeToClipboard();
  }
})();

