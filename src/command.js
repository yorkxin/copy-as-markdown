chrome.commands.onCommand.addListener(function(command) {
  switch(command) {
    case "current-tab-link":
      CopyAsMarkdown.copyCurrentTab();
      break;

    case "all-tabs-link-as-list":
      CopyAsMarkdown.copyAllTabs();
      break;
  }
});
