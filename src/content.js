chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    //var container = range.commonAncestorContainer;    // not good
    var html = undefined;
    if (range) {
        //
        // Get HTML from the selection
        // little hack from: http://groups.google.com/group/mozilla.dev.tech.dom/browse_thread/thread/7ecbbb066ff2027f
        //
        var div = document.createElement('div');
        div.appendChild(range.cloneContents());
        html = div.innerHTML;
    }

    var payload = {
        'text': selection.toString(),
        'html': html
    };
    sendResponse(payload);
});