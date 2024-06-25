let windowId = -1;
let tabId = -1;
let keepOpen = false;

// Install listeners
document.forms['form-popup-actions'].addEventListener('submit', (e) => {
  e.preventDefault();
  const button = e.submitter;
  const action = button.value;

  const message = { topic: action, params: { format: button.dataset.format } };

  if (action === 'export-current-tab') {
    message.params.tabId = tabId;
  } else if (action === 'export-tabs') {
    message.params.scope = button.dataset.scope;
    message.params.listType = button.dataset.listType;
    message.params.windowId = windowId;
  }

  chrome.runtime.sendMessage(message, (response) => {
    if (!response) {
      console.error('[FATAL] received nil response, type:', typeof response);
      return;
    }

    if (response.ok === false) {
      console.error('Failed to copy message, error: ', response.error);
      chrome.runtime.sendMessage({
        topic: 'badge',
        params: { type: 'error' },
      }, () => {
        if (!keepOpen) { // for tests
          window.close();
        }
      });
      return;
    }

    navigator.clipboard.writeText(response.text)
      .then(
        () => {
          chrome.runtime.sendMessage({
            topic: 'badge',
            params: { type: 'success' },
          }, () => {
            if (!keepOpen) { // for tests
              window.close();
            }
          });
        },
        (error) => {
          // failed
          console.error(error);
          chrome.runtime.sendMessage({
            topic: 'badge',
            params: { type: 'fail' },
          }, () => {
            if (!keepOpen) { // for tests
              window.close();
            }
          });
        },
      );
  });
});

document.getElementById('open-options').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});

const URL_PARAMS = new URLSearchParams(window.location.search);

if (URL_PARAMS.has('keep_open')) {
  keepOpen = true;
}

// NOTE: this function uses callback instead of async,
// because chrome.windows.getCurrent() does not return Promise in Firefox MV2.
function getCurrentWindow(callback) {
  if (URL_PARAMS.has('window')) {
    return chrome.windows.get(parseInt(URL_PARAMS.get('window'), 10), { populate: true }, callback);
  }
  return chrome.windows.getCurrent({ populate: true }, callback);
}

/**
 *
 * @param crWindow {chrome.windows.Window}
 * @returns {Promise<number>}
 */
async function getActiveTabId(crWindow) {
  if (URL_PARAMS.has('tab')) {
    return parseInt(URL_PARAMS.get('tab'), 10);
  }

  for (let i = 0; i < crWindow.tabs.length; i += 1) {
    const tab = crWindow.tabs[i];
    if (tab.active) {
      return tab.id;
    }
  }
  return -1;
}

getCurrentWindow(async (crWindow) => {
  windowId = crWindow.id;
  tabId = await getActiveTabId(crWindow);

  const tabsCount = crWindow.tabs.length;
  const highlightedCount = crWindow.tabs.filter((tab) => tab.highlighted).length;

  const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
  displayCountOfAllTabs.textContent = String(tabsCount);

  const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
  displayCountOfHighlightedTabs.textContent = String(highlightedCount);
});
