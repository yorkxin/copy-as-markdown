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
}

type ButtonLabel = string | ReturnType<typeof html>;

interface ButtonConfig {
  id?: string;
  action: 'export-current-tab' | 'export-tabs';
  scope?: ExportScope;
  format: ExportFormat;
  listType?: ListType;
  customFormatSlot?: string;
  label: ButtonLabel;
}

type ButtonActionConfig = Pick<ButtonConfig, 'action' | 'scope' | 'format' | 'listType' | 'customFormatSlot'>;

const URL_PARAMS = new URLSearchParams(window.location.search);
const root = document.getElementById('popup-root') ?? document.body;

let windowId = -1;
let tabId = -1;
const keepOpen = URL_PARAMS.has('keep_open');
let useMockClipboard = false;

let state: PopupState = {
  tabsCount: 0,
  highlightedCount: 0,
  multipleLinkFormats: [],
  singleLinkFormats: [],
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
        <div id="form-popup-actions">
          <div id="actions-export-current-tab">
            ${renderCurrentTabButtons()}
            ${s.singleLinkFormats.map(renderCurrentTabCustomButton)}
          </div>
          <hr class="dropdown-divider" />
          <div id="actions-export-all">
            ${renderExportAllButtons(s.tabsCount)}
            ${s.multipleLinkFormats.map(renderAllTabsCustomButton)}
          </div>
          <hr class="dropdown-divider" />
          <div id="actions-export-highlighted">
            ${renderExportHighlightedButtons(s.highlightedCount)}
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

function renderButton({
  id,
  label,
  ...config
}: ButtonConfig) {
  const actionConfig: ButtonActionConfig = {
    action: config.action,
    scope: config.scope,
    format: config.format,
    listType: config.listType,
    customFormatSlot: config.customFormatSlot,
  };

  return html`
    <button
      type="button"
      class="dropdown-item"
      id=${id ?? null}
      onclick=${() => handleAction(actionConfig)}
    >
      ${label}
    </button>
  `;
}

function renderCurrentTabButtons() {
  return renderButton({
    action: 'export-current-tab',
    format: 'link',
    id: 'current-tab-link',
    label: 'Current tab link',
  });
}

function renderExportAllButtons(tabsCount: number) {
  const btnAllTabsLinkAsList = renderButton({
    action: 'export-tabs',
    scope: 'all',
    format: 'link',
    listType: 'list',
    id: 'all-tabs-link-as-list',
    label: html`All tabs link (<span id="display-count-all-tabs">${tabsCount}</span>)`,
  });

  const btnAllTabsLinkAsTaskList = renderButton({
    action: 'export-tabs',
    scope: 'all',
    format: 'link',
    listType: 'task-list',
    id: 'all-tabs-link-as-task-list',
    label: 'All tabs link (task list)',
  });

  const btnAllTabsTitleAsList = renderButton({
    action: 'export-tabs',
    scope: 'all',
    format: 'title',
    listType: 'list',
    id: 'all-tabs-title-as-list',
    label: 'All tabs title',
  });

  const btnAllTabsUrlAsList = renderButton({
    action: 'export-tabs',
    scope: 'all',
    format: 'url',
    listType: 'list',
    id: 'all-tabs-url-as-list',
    label: 'All tabs URL',
  });

  return html`
    ${btnAllTabsLinkAsList}
    ${btnAllTabsLinkAsTaskList}
    ${btnAllTabsTitleAsList}
    ${btnAllTabsUrlAsList}
  `;
}

function renderExportHighlightedButtons(highlightedCount: number) {
  const btnHighlightedTabsLinkAsList = renderButton({
    action: 'export-tabs',
    scope: 'highlighted',
    format: 'link',
    listType: 'list',
    id: 'highlighted-tabs-link-as-list',
    label: html`Selected tabs link (<span id="display-count-highlighted-tabs">${highlightedCount}</span>)`,
  });
  const btnHighlightedTabsLinkAsTaskList = renderButton({
    action: 'export-tabs',
    scope: 'highlighted',
    format: 'link',
    listType: 'task-list',
    id: 'highlighted-tabs-link-as-task-list',
    label: 'Selected tabs link (task list)',
  });
  const btnHighlightedTabsTitleAsList = renderButton({
    action: 'export-tabs',
    scope: 'highlighted',
    format: 'title',
    listType: 'list',
    id: 'highlighted-tabs-title-as-list',
    label: 'Selected tabs title',
  });
  const btnHighlightedTabsUrlAsList = renderButton({
    action: 'export-tabs',
    scope: 'highlighted',
    format: 'url',
    listType: 'list',
    id: 'highlighted-tabs-url-as-list',
    label: 'Selected tabs URL',
  });
  return html`
    ${btnHighlightedTabsLinkAsList}
    ${btnHighlightedTabsLinkAsTaskList}
    ${btnHighlightedTabsTitleAsList}
    ${btnHighlightedTabsUrlAsList}
  `;
}

function renderAllTabsCustomButton(customFormat: CustomFormatMenuItem) {
  return renderButton({
    action: 'export-tabs',
    scope: 'all',
    format: 'custom-format',
    customFormatSlot: customFormat.slot,
    id: `all-tabs-custom-format-${customFormat.slot}`,
    label: `All tabs (${customFormat.displayName})`,
  });
}

function renderHighlightedTabsCustomButton(customFormat: CustomFormatMenuItem) {
  return renderButton({
    action: 'export-tabs',
    scope: 'highlighted',
    format: 'custom-format',
    customFormatSlot: customFormat.slot,
    id: `highlighted-tabs-custom-format-${customFormat.slot}`,
    label: `Selected tabs (${customFormat.displayName})`,
  });
}

function renderCurrentTabCustomButton(customFormat: CustomFormatMenuItem) {
  return renderButton({
    action: 'export-current-tab',
    format: 'custom-format',
    customFormatSlot: customFormat.slot,
    id: `current-tab-custom-format-${customFormat.slot}`,
    label: `Current tab (${customFormat.displayName})`,
  });
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

async function handleAction(config: ButtonActionConfig): Promise<void> {
  let message: RuntimeMessage;
  if (config.action === 'export-current-tab') {
    const format = (config.format || 'link') as Extract<ExportFormat, 'link' | 'custom-format'>;
    message = {
      topic: 'export-current-tab',
      params: {
        format,
        customFormatSlot: config.customFormatSlot ?? undefined,
        tabId,
      },
    };
  } else if (config.action === 'export-tabs') {
    const scope = (config.scope || 'all') as ExportScope;
    const format = (config.format || 'link') as ExportFormat;
    const listType = config.listType as ListType | undefined;
    message = {
      topic: 'export-tabs',
      params: {
        scope,
        format,
        listType,
        customFormatSlot: config.customFormatSlot ?? undefined,
        windowId,
      },
    };
  } else {
    throw new TypeError(`Unknown popup action: ${config.action}`);
  }

  try {
    const response = await sendMessage(message);
    if (response.text) {
      if (useMockClipboard) {
        const clipboardResponse = await browser.runtime.sendMessage({
          topic: 'copy-to-clipboard',
          params: { text: response.text },
        } satisfies RuntimeMessage) as MessageResponse | undefined;
        if (!clipboardResponse?.ok) {
          throw new Error(clipboardResponse?.error || 'Mock clipboard copy failed');
        }
      } else {
        await navigator.clipboard.writeText(response.text);
      }
    }
    await browser.runtime.sendMessage({
      topic: 'badge',
      params: { type: 'success' },
    } satisfies RuntimeMessage);
  } catch (error) {
    // @ts-expect-error - browser.runtime.lastError is not in types
    browser.runtime.lastError = error;
    await browser.runtime.sendMessage({
      topic: 'badge',
      params: { type: 'fail' },
    } satisfies RuntimeMessage);
  } finally {
    if (!keepOpen) {
      window.close();
    }
  }
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
  useMockClipboard = await checkMockClipboardAvailable();

  const crWindow = await getCurrentWindow();
  if (crWindow.id !== undefined) {
    windowId = crWindow.id;
  }
  tabId = await getActiveTabId(crWindow);

  const tabsCount = crWindow.tabs?.length ?? 0;
  const highlightedCount = crWindow.tabs?.filter((tab: browser.tabs.Tab) => tab.highlighted).length ?? 0;

  setState({ tabsCount, highlightedCount });
  await loadCustomFormats();
}

document.addEventListener('DOMContentLoaded', () => {
  render(root, popupView(state));
  void init();
});
