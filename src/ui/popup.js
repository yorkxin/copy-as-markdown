import CustomFormatsStorage from '../storage/custom-formats-storage.js';

let windowId = -1;
let tabId = -1;
let keepOpen = false;

/**
 * @typedef {Object} MessageParam
 * @property {string} format
 * @property {number|undefined} tabId
 * @property {string|undefined} scope
 * @property {string|undefined} listType
 * @property {number|undefined} windowId
 * @property {string|undefined} customFormatSlot
 */

/**
 * @typedef {Object} Message
 * @property {string} topic
 * @property {MessageParam} params
 */

/**
 *
 * @param {Message} message
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
  const message = {
    topic: action,
    params: {
      format: button.dataset.format,
      customFormatSlot: button.dataset.customFormatSlot,
    },
  };

  if (action === 'export-current-tab') {
    message.params.tabId = tabId;
  } else if (action === 'export-tabs') {
    message.params.scope = button.dataset.scope;
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
    // @ts-ignore
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

async function showCustomFormatsForExportTabs() {
  /** @type {HTMLTemplateElement} */
  const template = /** @type {HTMLTemplateElement} */ (document.getElementById('template-export-tabs-button'));
  const divExportAll = /** @type {HTMLDivElement} */ (document.getElementById('actions-export-all'));
  const divExportHighlighted = /** @type {HTMLDivElement} */ (document.getElementById('actions-export-highlighted'));

  const customFormats = await CustomFormatsStorage.list('multiple-links');
  customFormats.forEach((customFormat) => {
    if (!customFormat.showInMenus) {
      return;
    }

    const clone = /** @type {DocumentFragment} */ (template.content.cloneNode(true));

    /** @type {HTMLButtonElement} */
    const btnAll = clone.querySelector('button[data-scope="all"]');
    btnAll.dataset.customFormatSlot = customFormat.slot;
    btnAll.textContent += `(${customFormat.displayName})`;
    btnAll.id = `all-tabs-custom-format-${customFormat.slot}`;
    divExportAll.appendChild(btnAll);

    /** @type {HTMLButtonElement} */
    const btnHighlighted = clone.querySelector('button[data-scope="highlighted"]');
    btnHighlighted.dataset.customFormatSlot = customFormat.slot;
    btnHighlighted.textContent += `(${customFormat.displayName})`;
    btnHighlighted.id = `highlighted-tabs-custom-format-${customFormat.slot}`;
    divExportHighlighted.appendChild(btnHighlighted);
  });
}

async function showCustomFormatsForCurrentTab() {
  /** @type {HTMLTemplateElement} */
  const template = /** @type {HTMLTemplateElement} */ (document.getElementById('template-current-tab-button'));
  const divExportCurrent = /** @type {HTMLDivElement} */ (document.getElementById('actions-export-current-tab'));

  const customFormats = await CustomFormatsStorage.list('single-link');
  customFormats.forEach((customFormat) => {
    if (!customFormat.showInMenus) {
      return;
    }

    const clone = /** @type {DocumentFragment} */ (template.content.cloneNode(true));

    /** @type {HTMLButtonElement} */
    const btn = clone.querySelector('button[value="export-current-tab"]');
    btn.dataset.customFormatSlot = customFormat.slot;
    btn.id = `current-tab-custom-format-${customFormat.slot}`;
    btn.textContent += `(${customFormat.displayName})`;
    divExportCurrent.appendChild(btn);
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

  await showCustomFormatsForExportTabs();
  await showCustomFormatsForCurrentTab();
});
