chrome.commands.onCommand.addListener(function(command) {
  switch(command) {
    case "current-tab-link":
      CopyAsMarkdown.copyCurrentTab();
      break;

    case "all-tabs-link-as-list":
      CopyAsMarkdown.copyAllTabs();
      break;

    case "highlighted-tabs-link-as-list":
      CopyAsMarkdown.copyHighlightedTabs();
      break;

    case "selected-markdown":
      chrome.tabs.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
        active: true
      }, function(tabs) {
        chrome.tabs.sendRequest(tabs[0].id, {}, function(selection) {
        if (selection !== undefined) {
          CopyAsMarkdown.copySelection(selection.html, selection.text);
        }
        });
      });
      break;
  }
});
