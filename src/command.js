chrome.commands.onCommand.addListener(function(command) {
  console.log(CopyAsMarkdown);
  switch(command) {
    case "current-tab-link":
      CopyAsMarkdown.copyCurrentTab({ use_identifier: false });
      break;

    case "current-tab-link-with-identifier":
      CopyAsMarkdown.copyCurrentTab({ use_identifier: true });
      break;

    case "all-tabs-link-as-list":
      CopyAsMarkdown.copyAllTabs({ use_identifier: false });
      break;
  }
});
