import copy from '../lib/clipboard-access.js';
import flashBadge from './badge.js';
import * as BrowserAsMarkdown from '../lib/browser-as-markdown.js';

async function handleCopy(action) {
  /** @type {string} */
  const text = await BrowserAsMarkdown.handleExport(action);

  const currentTab = await chrome.tabs.getCurrent();

  // TODO: insert content script here for 'copy' command
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: copy,
    args: [text],
  },
  (results) => {
    console.log(results);
  });

  return text;
}

export default async function messageHandler({ topic = '', params = {} }) {
  switch (topic) {
    // FIXME: 'copy' handles convert to markdown and write to clipboard. should be separated.
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
