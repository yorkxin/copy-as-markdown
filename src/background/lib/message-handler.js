import BrowserAsMarkdown from "./browser-as-markdown.js";
import { copyMarkdownResponse } from "./clipboard-access.js"
import { flashSuccessBadge } from "../../lib/badge.js"

async function handleCopy(action) {
  let promise = null;

  switch (action) {
    case "current-tab-link": {
      promise = BrowserAsMarkdown.currentTab()
      break;
    }

    case "all-tabs-link-as-list": {
      promise = BrowserAsMarkdown.allTabs("link")
      break;
    }

    case "all-tabs-title-as-list": {
      promise = BrowserAsMarkdown.allTabs("title")
      break;
    }

    case "all-tabs-url-as-list": {
      promise = BrowserAsMarkdown.allTabs("url")
      break;
    }

    case "highlighted-tabs-link-as-list": {
      promise = BrowserAsMarkdown.highlightedTabs("link")
      break;
    }

    case "highlighted-tabs-title-as-list": {
      promise = BrowserAsMarkdown.highlightedTabs("title")
      break;
    }

    case "highlighted-tabs-url-as-list": {
      promise = BrowserAsMarkdown.highlightedTabs("url")
      break;
    }

    default: {
      throw new TypeError(`Unknown action: ${action}`);
    }
  }

  const response = await promise;
  await copyMarkdownResponse(response);
  return response;
}

async function handleBadge(params) {
  switch (params.action) {
    case "flashSuccess":
      return await flashSuccessBadge(params.text)

    default:
      throw new TypeError(`Unknown action: ${params.action}`);
  }
}

export function messageHandler({ topic = "", params = {} }) {
  switch (topic) {
    case "copy": {
      return handleCopy(params.action)
    }

    case "badge": {
      return handleBadge(params)
    }
  }
}
