import * as BrowserAsMarkdown from './browser-as-markdown.js';
import copy from './clipboard-access.js';
import flashBadge from './badge.js';

async function handleCopy(action) {
  /** @type {string} */
  let text;

  switch (action) {
    case 'current-tab-link': {
      text = await BrowserAsMarkdown.currentTab();
      break;
    }

    case 'all-tabs-link-as-list': {
      text = await BrowserAsMarkdown.allTabs('link');
      break;
    }

    case 'all-tabs-title-as-list': {
      text = await BrowserAsMarkdown.allTabs('title');
      break;
    }

    case 'all-tabs-url-as-list': {
      text = await BrowserAsMarkdown.allTabs('url');
      break;
    }

    case 'highlighted-tabs-link-as-list': {
      text = await BrowserAsMarkdown.highlightedTabs('link');
      break;
    }

    case 'highlighted-tabs-title-as-list': {
      text = await BrowserAsMarkdown.highlightedTabs('title');
      break;
    }

    case 'highlighted-tabs-url-as-list': {
      text = await BrowserAsMarkdown.highlightedTabs('url');
      break;
    }

    default: {
      throw new TypeError(`Unknown action: ${action}`);
    }
  }

  await copy(text);
  return text;
}

export default async function messageHandler({ topic = '', params = {} }) {
  switch (topic) {
    case 'copy': {
      try {
        await handleCopy(params.action);
        await flashBadge('success');
        return true;
      } catch (e) {
        await flashBadge('fail');
        throw e;
      }
    }

    case 'badge': {
      return flashBadge(params.type);
    }

    default: {
      throw TypeError(`Unknown message topic '${topic}'`);
    }
  }
}
