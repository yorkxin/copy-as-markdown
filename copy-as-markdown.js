(function() {
  var CopyAsMarkdown = new (function() {
    var resultContainer = document.getElementById("result-markdown");

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

      var result = "";
      if (options.use_identifier === true) {
        result = "[" + title + "][identifier]\n\n[identifier]: " + url;
      } else {
        result = "[" + title + "](" + url + ")";
      }

      return result;
    }

    this.copyLinkAsMarkdown = function(title, url, options) {
      var markdown = linkTo(title, url, options);
      setMarkdownResult(markdown);
      copyMarkdownCodeToClipboard();
      return markdown;
    }
  })();


  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    console.log(request);
    switch(request.action) {
      case "copyLinkAsMarkdown":
        var md = CopyAsMarkdown.copyLinkAsMarkdown(request.params.title, request.params.url, request.params.options);
        sendResponse({markdown: md});
        break;
      default:
        sendResponse({error: "Unknown Action " + request.action });
        break;
    }
  });
})();
