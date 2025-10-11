import CustomFormatsStorage from '../storage/custom-formats-storage.js';

let windowId = -1;
let tabId = -1;
let keepOpen = false;

interface MessageParam {
  format?: string;
  tabId?: number;
  scope?: string;
  listType?: string;
  windowId?: number;
  customFormatSlot?: string;
}

interface Message {
  topic: string;
  params: MessageParam;
}

interface MessageResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

async function sendMessage(message: Message): Promise<MessageResponse> {
  const response = await browser.runtime.sendMessage(message) as MessageResponse | undefined;

  if (!response) {
    throw new Error(`received nil response, type:${typeof response}`);
  }

  if (response.ok === false) {
    throw new Error(`Popup received an error from runtime: ${response.error}`);
  }

  return response;
}

// Install listeners
const formPopupActions = document.forms.namedItem('form-popup-actions');
if (formPopupActions) {
  formPopupActions.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter as HTMLButtonElement | null;
    if (!button) return;

    const action = button.value;

    const message: Message = {
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
      if (response.text) {
        await navigator.clipboard.writeText(response.text);
      }
      await browser.runtime.sendMessage({
        topic: 'badge',
        params: { type: 'success' },
      });
    } catch (error) {
      // @ts-expect-error - browser.runtime.lastError is not in types
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
}

const openOptionsButton = document.getElementById('open-options');
if (openOptionsButton) {
  openOptionsButton.addEventListener('click', async () => {
    await browser.runtime.openOptionsPage();
    window.close();
  });
}

const URL_PARAMS = new URLSearchParams(window.location.search);

if (URL_PARAMS.has('keep_open')) {
  keepOpen = true;
}

async function getCurrentWindow(): Promise<browser.windows.Window> {
  if (URL_PARAMS.has('window')) {
    const windowIdParam = URL_PARAMS.get('window');
    if (windowIdParam) {
      return browser.windows.get(Number.parseInt(windowIdParam, 10), { populate: true });
    }
  }
  return browser.windows.getCurrent({ populate: true });
}

async function getActiveTabId(crWindow: browser.windows.Window): Promise<number> {
  if (URL_PARAMS.has('tab')) {
    const tabIdParam = URL_PARAMS.get('tab');
    if (tabIdParam) {
      return Number.parseInt(tabIdParam, 10);
    }
  }

  if (crWindow.tabs) {
    for (let i = 0; i < crWindow.tabs.length; i += 1) {
      const tab = crWindow.tabs[i];
      if (tab && tab.active && tab.id !== undefined) {
        return tab.id;
      }
    }
  }
  return -1;
}

async function showCustomFormatsForExportTabs(): Promise<void> {
  const template = document.getElementById('template-export-tabs-button') as HTMLTemplateElement | null;
  const divExportAll = document.getElementById('actions-export-all') as HTMLDivElement | null;
  const divExportHighlighted = document.getElementById('actions-export-highlighted') as HTMLDivElement | null;

  if (!template || !divExportAll || !divExportHighlighted) {
    throw new Error('Missing required template or container elements');
  }

  const customFormats = await CustomFormatsStorage.list('multiple-links');
  customFormats.forEach((customFormat) => {
    if (!customFormat.showInMenus) {
      return;
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;

    const btnAll = clone.querySelector<HTMLButtonElement>('button[data-scope="all"]');
    if (btnAll) {
      btnAll.dataset.customFormatSlot = customFormat.slot;
      btnAll.textContent += `(${customFormat.displayName})`;
      btnAll.id = `all-tabs-custom-format-${customFormat.slot}`;
      divExportAll.appendChild(btnAll);
    }

    const btnHighlighted = clone.querySelector<HTMLButtonElement>('button[data-scope="highlighted"]');
    if (btnHighlighted) {
      btnHighlighted.dataset.customFormatSlot = customFormat.slot;
      btnHighlighted.textContent += `(${customFormat.displayName})`;
      btnHighlighted.id = `highlighted-tabs-custom-format-${customFormat.slot}`;
      divExportHighlighted.appendChild(btnHighlighted);
    }
  });
}

async function showCustomFormatsForCurrentTab(): Promise<void> {
  const template = document.getElementById('template-current-tab-button') as HTMLTemplateElement | null;
  const divExportCurrent = document.getElementById('actions-export-current-tab') as HTMLDivElement | null;

  if (!template || !divExportCurrent) {
    throw new Error('Missing required template or container elements');
  }

  const customFormats = await CustomFormatsStorage.list('single-link');
  customFormats.forEach((customFormat) => {
    if (!customFormat.showInMenus) {
      return;
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;

    const btn = clone.querySelector<HTMLButtonElement>('button[value="export-current-tab"]');
    if (btn) {
      btn.dataset.customFormatSlot = customFormat.slot;
      btn.id = `current-tab-custom-format-${customFormat.slot}`;
      btn.textContent += `(${customFormat.displayName})`;
      divExportCurrent.appendChild(btn);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const crWindow = await getCurrentWindow();
  if (crWindow.id !== undefined) {
    windowId = crWindow.id;
  }
  tabId = await getActiveTabId(crWindow);

  const tabsCount = crWindow.tabs?.length ?? 0;
  const highlightedCount = crWindow.tabs?.filter((tab: browser.tabs.Tab) => tab.highlighted).length ?? 0;

  const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
  if (displayCountOfAllTabs) {
    displayCountOfAllTabs.textContent = String(tabsCount);
  }

  const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
  if (displayCountOfHighlightedTabs) {
    displayCountOfHighlightedTabs.textContent = String(highlightedCount);
  }

  await showCustomFormatsForExportTabs();
  await showCustomFormatsForCurrentTab();
});
