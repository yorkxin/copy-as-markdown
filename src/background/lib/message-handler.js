import BrowserAsMarkdown from "./browser-as-markdown.js";
import { copyMarkdownResponse } from "./clipboard-access.js"
import { flashSuccessBadge } from "../../lib/badge.js"

let handleCopy = ({ action = null, executeCopy = true }) => {
  let promise = null;
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
      return Promise.reject(`Unkonwn action: ${action}`)
    }
  }

  if (executeCopy) {
    return promise.then(response => copyMarkdownResponse(response))
  } else {
    return promise;
  }
}

let handleBadge = ({ action = "", text = "" }) => {
  switch (action) {
    case "flashSuccess":
      return flashSuccessBadge(text)

    default:
      return Promise.reject(`Unknown action: ${action}`)
  }
}

export default ({ topic = "", params = {} }) => {
  switch (topic) {
    case "copy": {
      return handleCopy(params)
    }

    case "badge": {
      return handleBadge(params)
    }
  }
}
