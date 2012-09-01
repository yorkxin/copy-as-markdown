chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  var md = "";
  switch(request.action) {
    case "copyLink":
      md = CopyAsMarkdown.copyLink(request.params.title, request.params.url, request.params.options);
      sendResponse({markdown: md});
      break;
    case "copyListOfLinks":
      md = CopyAsMarkdown.copyListOfLinks(request.params.links, request.params.options);
      sendResponse({markdown: md});
      break;
    default:
      sendResponse({error: "Unknown Action " + request.action });
      break;
  }
});

