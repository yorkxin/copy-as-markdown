chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  switch(request.action) {
    case "copyLinkAsMarkdown":
      var md = CopyAsMarkdown.copyLinkAsMarkdown(request.params.title, request.params.url, request.params.options);
      sendResponse({markdown: md});
      break;
    case "copyLinksAsListMarkdown":
      var md = CopyAsMarkdown.copyLinksAsListMarkdown(request.params.links, request.params.options);
      sendResponse({markdown: md});
      break;
    default:
      sendResponse({error: "Unknown Action " + request.action });
      break;
  }
});

