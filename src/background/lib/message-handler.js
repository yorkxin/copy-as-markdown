import BrowserAsMarkdown from "./browser-as-markdown.js";
import { copyMarkdownResponse } from "./clipboard-access.js"

export default (action) => {
  switch (action) {
    case "current-tab-link": {
      return BrowserAsMarkdown.currentTab()
        .then(response => copyMarkdownResponse(response))
    }

    case "all-tabs-link-as-list": {
      return BrowserAsMarkdown.allTabs()
        .then(response => copyMarkdownResponse(response))
    }

    case "highlighted-tabs-link-as-list": {
      return BrowserAsMarkdown.highlightedTabs()
        .then(response => copyMarkdownResponse(response))
    }
  }
}
