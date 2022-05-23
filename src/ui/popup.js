import * as BrowserAsMarkdown from '../lib/browser-as-markdown.js';
import copy from '../lib/clipboard-access.js';

// Install listeners
document.querySelectorAll('[data-action]').forEach((element) => {
  element.addEventListener('click', async (event) => {
    const { action } = event.currentTarget.dataset;

    const text = await BrowserAsMarkdown.handleExport(action);
    await copy(text);
    await chrome.runtime.sendMessage({ topic: 'badge', params: { type: 'success' } }, () => {
      window.close();
    });
  });
});

document.body.classList.add('custom-popup-style');

chrome.windows.getCurrent({ populate: true }, (crWindow) => {
  const tabsCount = crWindow.tabs.length;
  const highlightedCount = crWindow.tabs.filter((tab) => tab.highlighted).length;

  const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
  displayCountOfAllTabs.textContent = String(tabsCount);

  const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
  displayCountOfHighlightedTabs.textContent = String(highlightedCount);
});
