import BrowserAsMarkdown from "./browser-as-markdown.js";
import { copyMarkdownResponse } from "./clipboard-access.js"

export default ({ action, executeCopy = true }) => {
  let promise = null;

  console.log(action, executeCopy)
  switch (action) {
    case "current-tab-link": {
      promise = BrowserAsMarkdown.currentTab()
      break;
    }

    case "all-tabs-link-as-list": {
      promise = BrowserAsMarkdown.allTabs()
      break;
    }

    case "highlighted-tabs-link-as-list": {
      promise = BrowserAsMarkdown.highlightedTabs()
      break;
    }

    default: {
      return Promise.reject(`Unkonwn action ${action}`)
    }
  }

  if (executeCopy) {
    return promise.then(response => copyMarkdownResponse(response))
  } else {
    return promise;
  }
}
