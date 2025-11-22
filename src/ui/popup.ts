import { html, render } from '../vendor/uhtml.js';
import type { RuntimeMessage } from '../contracts/messages.js';
import type { ExportFormat, ExportScope, ListType } from '../services/tab-export-service.js';
import CustomFormatsStorage from '../storage/custom-formats-storage.js';

interface MessageResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

interface CustomFormatMenuItem {
  slot: string;
  displayName: string;
}

interface PopupState {
  tabsCount: number;
  highlightedCount: number;
  multipleLinkFormats: CustomFormatMenuItem[];
  singleLinkFormats: CustomFormatMenuItem[];
  flashMessage: string;
  ready: boolean;
  windowId: number;
  tabId: number;
}

const URL_PARAMS = new URLSearchParams(window.location.search);
const root = document.getElementById('popup-root') ?? document.body;

const keepOpen = URL_PARAMS.has('keep_open');
let useMockClipboard = false;

let state: PopupState = {
  tabsCount: 0,
  highlightedCount: 0,
  multipleLinkFormats: [],
  singleLinkFormats: [],
  flashMessage: '',
  ready: false,
  windowId: -1,
  tabId: -1,
};

function setState(next: Partial<PopupState>): void {
  state = { ...state, ...next };
  render(root, popupView(state));
}

function popupView(s: PopupState) {
  return html`
  <div class="dropdown is-active">
    <div class="dropdown-menu is-relative p-0" role="menu">
      <div class="dropdown-content is-radiusless is-shadowless p-0">
        ${s.flashMessage
          ? html`<div class="notification is-danger is-light is-radiusless mb-0">
              <button class="delete" aria-label="Close notification" onclick=${() => setState({ flashMessage: '' })}></button>
              ${s.flashMessage}
            </div>`
          : null}
        <div id="form-popup-actions">
          <div id="actions-export-current-tab">
            <button
              type="button"
              class="dropdown-item"
              id="current-tab-link"
              onclick=${() => exportCurrentTab('link')}
              disabled=${!s.ready}
            >
              Current tab link
            </button>
            ${s.singleLinkFormats.map(renderCurrentTabCustomButton)}
          </div>
          <hr class="dropdown-divider" />
          <div id="actions-export-all">
            <button
              type="button"
              class="dropdown-item"
              id="all-tabs-link-as-list"
              onclick=${() => exportTabs('all', 'link', 'list')}
              disabled=${!s.ready}
            >
              All tabs link (<span id="display-count-all-tabs">${s.tabsCount}</span>)
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="all-tabs-link-as-task-list"
              onclick=${() => exportTabs('all', 'link', 'task-list')}
              disabled=${!s.ready}
            >
              All tabs link (task list)
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="all-tabs-title-as-list"
              onclick=${() => exportTabs('all', 'title', 'list')}
              disabled=${!s.ready}
            >
              All tabs title
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="all-tabs-url-as-list"
              onclick=${() => exportTabs('all', 'url', 'list')}
              disabled=${!s.ready}
            >
              All tabs URL
            </button>
            ${s.multipleLinkFormats.map(renderAllTabsCustomButton)}
          </div>
          <hr class="dropdown-divider" />
          <div id="actions-export-highlighted">
            <button
              type="button"
              class="dropdown-item"
              id="highlighted-tabs-link-as-list"
              onclick=${() => exportTabs('highlighted', 'link', 'list')}
              disabled=${!s.ready}
            >
              Selected tabs link (<span id="display-count-highlighted-tabs">${s.highlightedCount}</span>)
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="highlighted-tabs-link-as-task-list"
              onclick=${() => exportTabs('highlighted', 'link', 'task-list')}
              disabled=${!s.ready}
            >
              Selected tabs link (task list)
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="highlighted-tabs-title-as-list"
              onclick=${() => exportTabs('highlighted', 'title', 'list')}
              disabled=${!s.ready}
            >
              Selected tabs title
            </button>
            <button
              type="button"
              class="dropdown-item"
              id="highlighted-tabs-url-as-list"
              onclick=${() => exportTabs('highlighted', 'url', 'list')}
              disabled=${!s.ready}
            >
              Selected tabs URL
            </button>
            ${s.multipleLinkFormats.map(renderHighlightedTabsCustomButton)}
          </div>
        </div>
        <hr class="dropdown-divider" />
        <button type="button" class="dropdown-item" id="open-options" onclick=${openOptions}>Options&hellip;</button>
      </div>
    </div>
  </div>
  `;
}

function renderAllTabsCustomButton(customFormat: CustomFormatMenuItem) {
  return html`
    <button
      type="button"
      class="dropdown-item"
      id=${`all-tabs-custom-format-${customFormat.slot}`}
      onclick=${() => exportTabsCustomFormat('all', customFormat.slot)}
      disabled=${!state.ready}
    >
      All tabs (${customFormat.displayName})
    </button>
  `;
}

function renderHighlightedTabsCustomButton(customFormat: CustomFormatMenuItem) {
  return html`
    <button
      type="button"
      class="dropdown-item"
      id=${`highlighted-tabs-custom-format-${customFormat.slot}`}
      onclick=${() => exportTabsCustomFormat('highlighted', customFormat.slot)}
      disabled=${!state.ready}
    >
      Selected tabs (${customFormat.displayName})
    </button>
  `;
}

function renderCurrentTabCustomButton(customFormat: CustomFormatMenuItem) {
  return html`
    <button
      type="button"
      class="dropdown-item"
      id=${`current-tab-custom-format-${customFormat.slot}`}
      onclick=${() => exportCurrentTab('custom-format', customFormat.slot)}
      disabled=${!state.ready}
    >
      Current tab (${customFormat.displayName})
    </button>
  `;
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

async function exportCurrentTab(
  format: Extract<ExportFormat, 'link' | 'custom-format'>,
  customFormatSlot?: string,
): Promise<void> {
  if (!state.ready || state.tabId === -1) return;

  const message: RuntimeMessage = {
    topic: 'export-current-tab',
    params: {
      format,
      customFormatSlot,
      tabId: state.tabId,
    },
  };

  await performExport(message);
}

async function exportTabs(
  scope: ExportScope,
  format: Exclude<ExportFormat, 'custom-format'>,
  listType: ListType,
): Promise<void> {
  if (!state.ready || state.windowId === -1) return;

  const message: RuntimeMessage = {
    topic: 'export-tabs',
    params: {
      scope,
      format,
      listType,
      windowId: state.windowId,
    },
  };

  await performExport(message);
}

async function exportTabsCustomFormat(
  scope: ExportScope,
  customFormatSlot: string,
): Promise<void> {
  if (!state.ready || state.windowId === -1) return;

  const message: RuntimeMessage = {
    topic: 'export-tabs',
    params: {
      scope,
      format: 'custom-format',
      customFormatSlot,
      windowId: state.windowId,
    },
  };

  await performExport(message);
}

async function performExport(message: RuntimeMessage): Promise<void> {
  try {
    const response = await sendMessage(message);
    if (response.text) {
      await handleExportResponse(response.text);
    }
    await sendBadgeSafe('success');
    setState({ flashMessage: '' });
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
    setState({ flashMessage: 'Failed to copy to clipboard. Please try again.' });
  }
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

async function sendBadge(type: 'success' | 'fail'): Promise<void> {
  await browser.runtime.sendMessage({
    topic: 'badge',
    params: { type },
  } satisfies RuntimeMessage);
}

async function sendBadgeSafe(type: 'success' | 'fail'): Promise<void> {
  try {
    await sendBadge(type);
  } catch (error) {
    console.error('Failed to update badge', error);
  }
}

function isTabsPermissionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Tabs permission required');
}

async function openOptions(): Promise<void> {
  await browser.runtime.openOptionsPage();
  window.close();
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

async function loadCustomFormats(): Promise<void> {
  const multiple = await CustomFormatsStorage.list('multiple-links');
  const single = await CustomFormatsStorage.list('single-link');

  setState({
    multipleLinkFormats: multiple
      .filter(customFormat => customFormat.showInMenus)
      .map(customFormat => ({
        slot: customFormat.slot,
        displayName: customFormat.displayName,
      })),
    singleLinkFormats: single
      .filter(customFormat => customFormat.showInMenus)
      .map(customFormat => ({
        slot: customFormat.slot,
        displayName: customFormat.displayName,
      })),
  });
}

async function init(): Promise<void> {
  try {
    useMockClipboard = await checkMockClipboardAvailable();

    const crWindow = await getCurrentWindow();
    if (crWindow.id !== undefined) {
      state = { ...state, windowId: crWindow.id };
    }
    const activeTabId = await getActiveTabId(crWindow);

    const tabsCount = crWindow.tabs?.length ?? 0;
    const highlightedCount = crWindow.tabs?.filter((tab: browser.tabs.Tab) => tab.highlighted).length ?? 0;

    setState({ tabsCount, highlightedCount, ready: true, tabId: activeTabId });
    await loadCustomFormats();
  } catch (error) {
    console.error('Failed to initialize popup', error);
    setState({ flashMessage: 'Failed to load tabs or settings. Please reopen the popup.' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  render(root, popupView(state));
  void init();
});
