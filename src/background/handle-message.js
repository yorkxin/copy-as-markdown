import CopyAsMarkdown from "copy-as-markdown";

export default function(action) {
  switch(action) {
    case "current-tab-link":
      CopyAsMarkdown.copyCurrentTab();
      break;

    case "all-tabs-link-as-list":
      CopyAsMarkdown.copyAllTabs();
      break;

    case "highlighted-tabs-link-as-list":
      CopyAsMarkdown.copyHighlightedTabs();
      break;
  }
}
