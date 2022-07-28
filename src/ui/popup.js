import copy from '../lib/clipboard-access.js';

// Install listeners
document.querySelectorAll('[data-action]').forEach((element) => {
  element.addEventListener('click', async (event) => {
    const { action } = event.currentTarget.dataset;

    chrome.runtime.sendMessage({ topic: 'export', params: { action } }, (response) => {
      if (!response) {
        console.error('[FATAL] received nil response, type:', typeof response);
        return;
      }

      if (response.ok === false) {
        console.error('Failed to copy message, error: ', response.error);
        chrome.runtime.sendMessage({ topic: 'badge', params: { type: 'error' } }, () => {
          window.close();
        });
      }

      copy(response.text).then(() => {
        chrome.runtime.sendMessage({ topic: 'badge', params: { type: 'success' } }, () => {
          window.close();
        });
      });
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
