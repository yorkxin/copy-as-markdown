chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {
    
    var selection = window.getSelection();
	var range = selection.getRangeAt(0);
	var container = range.commonAncestorContainer;

	var payload = {
	  'text': selection.toString(),
	  'html': container.innerHTML
	};
    sendResponse(payload);
});