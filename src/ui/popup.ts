import type { RuntimeMessage } from '../contracts/messages.js';
import type { ExportFormat, ExportScope, ListType } from '../services/tab-export-service.js';
import CustomFormatsStorage from '../storage/custom-formats-storage.js';

interface MessageResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

const URL_PARAMS = new URLSearchParams(window.location.search);
let windowId = -1;
let tabId = -1;
const keepOpen = URL_PARAMS.has('keep_open');
let useMockClipboard = false;
let ready = false;

const displayCountOfAllTabs = document.getElementById('display-count-all-tabs');
const displayCountOfHighlightedTabs = document.getElementById('display-count-highlighted-tabs');
const actionsExportAll = document.getElementById('actions-export-all') as HTMLDivElement | null;
const actionsExportHighlighted = document.getElementById('actions-export-highlighted') as HTMLDivElement | null;
const actionsExportCurrent = document.getElementById('actions-export-current-tab') as HTMLDivElement | null;
const flash = document.getElementById('flash-message');
const flashText = document.getElementById('flash-text');

function hideFlash(): void {
  if (!flash) return;
  flash.classList.add('is-hidden');
  if (flashText) flashText.textContent = '';
}

function showFlash(message: string): void {
  if (!flash) return;
  flash.classList.remove('is-hidden');
  if (flashText) flashText.textContent = message;
}

function setButtonsDisabled(disabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('#form-popup-actions button').forEach((btn) => {
    btn.disabled = disabled;
  });
}

function createCustomButton({
  id,
  label,
  onClick,
}: { id: string; label: string; onClick: () => void }): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dropdown-item';
  btn.id = id;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  btn.disabled = !ready;
  return btn;
}

async function sendMessage(message: RuntimeMessage): Promise<MessageResponse> {
  const response = await browser.runtime.sendMessage(message) as MessageResponse | undefined;

  if (!response) {
    throw new Error(`received nil response, type:${typeof response}`);
  }

  if (response.ok === false) {
    throw new Error(`Popup received an error from runtime: ${response.error}`);
  }

  return response;
}

async function handleExportResponse(text: string): Promise<void> {
  if (useMockClipboard) {
    const clipboardResponse = await browser.runtime.sendMessage({
      topic: 'copy-to-clipboard',
      params: { text },
    } satisfies RuntimeMessage) as MessageResponse | undefined;
    if (!clipboardResponse?.ok) {
      throw new Error(clipboardResponse?.error || 'Mock clipboard copy failed');
    }
  } else {
    await navigator.clipboard.writeText(text);
  }
}

async function sendBadgeSafe(type: 'success' | 'fail'): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      topic: 'badge',
      params: { type },
    } satisfies RuntimeMessage);
  } catch (error) {
    console.error('Failed to update badge', error);
  }
}

function clearFlash(): void {
  hideFlash();
}

async function performExport(message: RuntimeMessage): Promise<void> {
  try {
    const response = await sendMessage(message);
    if (response.text) {
      await handleExportResponse(response.text);
    }
    await sendBadgeSafe('success');
    clearFlash();
    if (!keepOpen) {
      window.close();
    }
  } catch (error) {
    // @ts-expect-error - browser.runtime.lastError is not in types
    browser.runtime.lastError = error;
    await sendBadgeSafe('fail');
    if (isTabsPermissionError(error)) {
      return;
    }
    showFlash('Failed to copy to clipboard. Please try again.');
  }
}

async function exportCurrentTab(
  format: Extract<ExportFormat, 'link' | 'custom-format'>,
  customFormatSlot?: string,
): Promise<void> {
  if (!ready || tabId === -1) return;
  const message: RuntimeMessage = {
    topic: 'export-current-tab',
    params: {
      format,
      customFormatSlot,
      tabId,
    },
  };

  await performExport(message);
}

async function exportTabs(
  scope: ExportScope,
  format: Exclude<ExportFormat, 'custom-format'>,
  listType: ListType,
): Promise<void> {
  if (!ready || windowId === -1) return;
  const message: RuntimeMessage = {
    topic: 'export-tabs',
    params: {
      scope,
      format,
      listType,
      windowId,
    },
  };

  await performExport(message);
}

async function exportTabsCustomFormat(
  scope: ExportScope,
  customFormatSlot: string,
): Promise<void> {
  if (!ready || windowId === -1) return;
  const message: RuntimeMessage = {
    topic: 'export-tabs',
    params: {
      scope,
      format: 'custom-format',
      customFormatSlot,
      windowId,
    },
  };

  await performExport(message);
}

async function checkMockClipboardAvailable(): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      topic: 'check-mock-clipboard',
      params: {},
    } satisfies RuntimeMessage) as MessageResponse;
    return response.ok && response.text === 'true';
  } catch {
    return false;
  }
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

async function loadCustomFormats(): Promise<void> {
  if (!actionsExportAll || !actionsExportHighlighted || !actionsExportCurrent) return;

  // clear previous custom buttons
  actionsExportAll.querySelectorAll('[id^="all-tabs-custom-format"]').forEach(el => el.remove());
  actionsExportHighlighted.querySelectorAll('[id^="highlighted-tabs-custom-format"]').forEach(el => el.remove());
  actionsExportCurrent.querySelectorAll('[id^="current-tab-custom-format"]').forEach(el => el.remove());

  const multiple = await CustomFormatsStorage.list('multiple-links');
  const single = await CustomFormatsStorage.list('single-link');

  multiple
    .filter(customFormat => customFormat.showInMenus)
    .forEach((customFormat) => {
      const btnAll = createCustomButton({
        id: `all-tabs-custom-format-${customFormat.slot}`,
        label: `All tabs (${customFormat.displayName})`,
        onClick: () => exportTabsCustomFormat('all', customFormat.slot),
      });
      actionsExportAll.appendChild(btnAll);

      const btnHighlighted = createCustomButton({
        id: `highlighted-tabs-custom-format-${customFormat.slot}`,
        label: `Selected tabs (${customFormat.displayName})`,
        onClick: () => exportTabsCustomFormat('highlighted', customFormat.slot),
      });
      actionsExportHighlighted.appendChild(btnHighlighted);
    });

  single
    .filter(customFormat => customFormat.showInMenus)
    .forEach((customFormat) => {
      const btn = createCustomButton({
        id: `current-tab-custom-format-${customFormat.slot}`,
        label: `Current tab (${customFormat.displayName})`,
        onClick: () => exportCurrentTab('custom-format', customFormat.slot),
      });
      actionsExportCurrent.appendChild(btn);
    });
}

function wireStaticButtons(): void {
  const currentTabBtn = document.getElementById('current-tab-link');
  currentTabBtn?.addEventListener('click', () => exportCurrentTab('link'));

  const allTabsLinkList = document.getElementById('all-tabs-link-as-list');
  allTabsLinkList?.addEventListener('click', () => exportTabs('all', 'link', 'list'));
  const allTabsLinkTask = document.getElementById('all-tabs-link-as-task-list');
  allTabsLinkTask?.addEventListener('click', () => exportTabs('all', 'link', 'task-list'));
  const allTabsTitleList = document.getElementById('all-tabs-title-as-list');
  allTabsTitleList?.addEventListener('click', () => exportTabs('all', 'title', 'list'));
  const allTabsUrlList = document.getElementById('all-tabs-url-as-list');
  allTabsUrlList?.addEventListener('click', () => exportTabs('all', 'url', 'list'));

  const highlightedLinkList = document.getElementById('highlighted-tabs-link-as-list');
  highlightedLinkList?.addEventListener('click', () => exportTabs('highlighted', 'link', 'list'));
  const highlightedLinkTask = document.getElementById('highlighted-tabs-link-as-task-list');
  highlightedLinkTask?.addEventListener('click', () => exportTabs('highlighted', 'link', 'task-list'));
  const highlightedTitleList = document.getElementById('highlighted-tabs-title-as-list');
  highlightedTitleList?.addEventListener('click', () => exportTabs('highlighted', 'title', 'list'));
  const highlightedUrlList = document.getElementById('highlighted-tabs-url-as-list');
  highlightedUrlList?.addEventListener('click', () => exportTabs('highlighted', 'url', 'list'));

  const flashClose = flash?.querySelector('button.delete');
  flashClose?.addEventListener('click', hideFlash);

  const openOptionsButton = document.getElementById('open-options');
  openOptionsButton?.addEventListener('click', async () => {
    await browser.runtime.openOptionsPage();
    window.close();
  });
}

function setCounts(tabsCount: number, highlightedCount: number): void {
  if (displayCountOfAllTabs) {
    displayCountOfAllTabs.textContent = String(tabsCount);
  }
  if (displayCountOfHighlightedTabs) {
    displayCountOfHighlightedTabs.textContent = String(highlightedCount);
  }
}

function isTabsPermissionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Tabs permission required');
}

document.addEventListener('DOMContentLoaded', () => {
  const initPromise = (async () => {
    try {
      setButtonsDisabled(true);
      useMockClipboard = await checkMockClipboardAvailable();

      const crWindow = await getCurrentWindow();
      if (crWindow.id !== undefined) {
        windowId = crWindow.id;
      }
      tabId = await getActiveTabId(crWindow);

      const tabsCount = crWindow.tabs?.length ?? 0;
      const highlightedCount = crWindow.tabs?.filter((tab: browser.tabs.Tab) => tab.highlighted).length ?? 0;
      setCounts(tabsCount, highlightedCount);

      await loadCustomFormats();
      ready = true;
      setButtonsDisabled(false);
      hideFlash();
    } catch (error) {
      console.error('Failed to initialize popup', error);
      showFlash('Failed to load tabs or settings. Please reopen the popup.');
    }
  })();

  // expose for tests
  (window as any).__popupReady = initPromise;
});

wireStaticButtons();
