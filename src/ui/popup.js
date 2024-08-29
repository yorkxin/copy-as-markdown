import CustomFormatsStorage from '../storage/custom-formats-storage.js';

let windowId = -1;
let tabId = -1;
let keepOpen = false;

/**
 * @typedef {Object} MessageParam
 * @property {string} format
 * @property {string|undefined} tabId
 * @property {string|undefined} scope
 * @property {string|undefined} listType
 * @property {string|undefined} customFormatSlot
 * @property {string|undefined} windowId
 */

/**
 * @typedef {Object} Message
 * @property {string} topic
 * @property {MessageParam} params
 */

/**
 *
 * @param message {Message}
 * @returns {Promise<{ok: true, text: string|undefined}>}
 */
async function sendMessage(message) {
  const response = await browser.runtime.sendMessage(message);

  if (!response) {
    throw new Error(`received nil response, type:${typeof response}`);
  }

  if (response.ok === false) {
    throw new Error(`Popup received an error from runtime: ${response.error}`);
  }

  return response;
}

// Install listeners
document.forms['form-popup-actions'].addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.submitter;
  const action = button.value;

  /** @type {Message} */
  const message = { topic: action, params: { format: button.dataset.format } };

  if (action === 'export-current-tab') {
    message.params.tabId = tabId;
  } else if (action === 'export-tabs') {
    message.params.scope = button.dataset.scope;
    message.params.customFormatSlot = button.dataset.customFormatSlot;
    message.params.listType = button.dataset.listType;
    message.params.windowId = windowId;
  }

  try {
    const response = await sendMessage(message);
    await navigator.clipboard.writeText(response.text);
    await browser.runtime.sendMessage({
      topic: 'badge',
      params: { type: 'success' },
    });
  } catch (error) {
    browser.runtime.lastError = error;
    await browser.runtime.sendMessage({
      topic: 'badge',
      params: { type: 'fail' },
    });
  } finally {
    if (!keepOpen) { // for tests
      window.close();
    }
  }
});

document.getElementById('open-options').addEventListener('click', async () => {
  await browser.runtime.openOptionsPage();
  window.close();
});

const URL_PARAMS = new URLSearchParams(window.location.search);

if (URL_PARAMS.has('keep_open')) {
  keepOpen = true;
}

async function getCurrentWindow() {
  if (URL_PARAMS.has('window')) {
    return browser.windows.get(parseInt(URL_PARAMS.get('window'), 10), { populate: true });
  }
  return browser.windows.getCurrent({ populate: true });
}

/**
 *
 * @param crWindow {browser.windows.Window}
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

async function showCustomFormats() {
  /** @type {HTMLTemplateElement} */
  const template = document.getElementById('template-export-tabs-button');
  const divExportAll = document.getElementById('actions-export-all');
  const divExportHighlighted = document.getElementById('actions-export-highlighted');

  const customFormats = await CustomFormatsStorage.list('tabs');
  customFormats.forEach((customFormat) => {
    if (!customFormat.showInPopupMenu) {
      return;
    }

    const clone = template.content.cloneNode(true);

    /** @type {HTMLButtonElement} */
    const btnAll = clone.querySelector('button[data-scope="all"]');
    btnAll.dataset.customFormatSlot = customFormat.slot;
    btnAll.textContent += `(${customFormat.name})`;
    divExportAll.appendChild(btnAll);

    /** @type {HTMLButtonElement} */
    const btnHighlighted = clone.querySelector('button[data-scope="highlighted"]');
    btnHighlighted.dataset.customFormatSlot = customFormat.slot;
    btnHighlighted.textContent += `(${customFormat.name})`;
    divExportHighlighted.appendChild(btnHighlighted);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const crWindow = await getCurrentWindow();
  windowId = crWindow.id;
  tabId = await getActiveTabId(crWindow);

  const tabsCount = crWindow.tabs.length;
  const highlightedCount = crWindow.tabs.filter((tab) => tab.highlighted).length;

  const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
  displayCountOfAllTabs.textContent = String(tabsCount);

  const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
  displayCountOfHighlightedTabs.textContent = String(highlightedCount);

  await showCustomFormats();
});
