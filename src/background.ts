import Settings from './lib/settings.js';
import Markdown from './lib/markdown.js';
import { Bookmarks } from './bookmarks.js';
import CustomFormatsStorage from './storage/custom-formats-storage.js';
import { createBrowserBadgeService } from './services/badge-service.js';
import { createBrowserContextMenuService } from './services/context-menu-service.js';
import { TabExportService } from './services/tab-export-service.js';
import { createBrowserClipboardService } from './services/clipboard-service.js';
import { LinkExportService } from './services/link-export-service.js';
import { createBrowserSelectionConverterService } from './services/selection-converter-service.js';
import { createBrowserHandlerCore } from './handlers/handler-core.js';
import { createKeyboardBrowserCommandHandler } from './handlers/keyboard-command-handler.js';
import { createBrowserContextMenuHandler } from './handlers/context-menu-handler.js';
import { createBrowserRuntimeMessageHandler } from './handlers/runtime-message-handler.js';

const ALARM_REFRESH_MENU = 'refreshMenu';

// Initialize markdown and bookmarks
const markdownInstance = new Markdown();
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

// Initialize services
const badgeService = createBrowserBadgeService();
const contextMenuService = createBrowserContextMenuService(CustomFormatsStorage);
const tabExportService = new TabExportService(markdownInstance, CustomFormatsStorage);
const linkExportService = new LinkExportService(markdownInstance, CustomFormatsStorage);

// Check if ALWAYS_USE_NAVIGATOR_COPY_API flag is set
const useNavigatorClipboard = (globalThis as any).ALWAYS_USE_NAVIGATOR_COPY_API === true;
const iframeCopyUrl = browser.runtime.getURL('dist/static/iframe-copy.html');
const clipboardService = createBrowserClipboardService(
  useNavigatorClipboard ? navigator.clipboard : null,
  iframeCopyUrl,
);

// Selection converter service with turndown options provider
const turndownJsUrl = 'dist/vendor/turndown.js';
const selectionConverterService = createBrowserSelectionConverterService(
  {
    getTurndownOptions: () => ({
      headingStyle: 'atx',
      bulletListMarker: markdownInstance.unorderedListChar,
    }),
  },
  turndownJsUrl,
);

// Handler core (shared by all handlers)
const handlerCore = createBrowserHandlerCore(
  linkExportService,
  tabExportService,
  selectionConverterService,
);

// Keyboard command handler
const keyboardCommandHandler = createKeyboardBrowserCommandHandler(handlerCore);

// Context menu handler
const contextMenuHandler = createBrowserContextMenuHandler(
  handlerCore,
  bookmarks,
);

// Runtime message handler
const runtimeMessageHandler = createBrowserRuntimeMessageHandler(handlerCore);

async function refreshMarkdownInstance(): Promise<void> {
  let settings;
  try {
    settings = await Settings.getAll();
  } catch (error) {
    console.error('error getting settings', error);
    return;
  }

  markdownInstance.alwaysEscapeLinkBracket = settings.alwaysEscapeLinkBrackets;
  markdownInstance.unorderedListStyle = settings.styleOfUnorderedList;
  markdownInstance.indentationStyle = settings.styleOfTabGroupIndentation;
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === badgeService.getClearAlarmName()) {
    await badgeService.clear();
  }

  if (alarm.name === ALARM_REFRESH_MENU) {
    await browser.contextMenus.removeAll();
    await contextMenuService.createAll();
  }
});

contextMenuService.createAll().then(() => null /* NOP */);
browser.storage.sync.onChanged.addListener(async (changes) => {
  if (Object.keys(changes).includes(CustomFormatsStorage.KeyOfLastUpdate())) {
    await contextMenuService.createAll();
  }
});

if ((globalThis as any).PERIDOCIALLY_REFRESH_MENU === true) {
  // Hack for Firefox, in which Context Menu disappears after some time.
  // See https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/7
  console.info('Hack PERIDOCIALLY_REFRESH_MENU is enabled');
  browser.alarms.create('refreshMenu', { periodInMinutes: 0.5 });
}

// NOTE: All listeners must be registered at top level scope.

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const text = await contextMenuHandler.handleMenuClick(info, tab);
    await clipboardService.copy(text, tab);
    await badgeService.showSuccess();
    return true;
  } catch (error) {
    console.error(error);
    await badgeService.showError();
    throw error;
  }
});

// listen to keyboard shortcuts
browser.commands.onCommand.addListener(async (command: string, tab?: browser.tabs.Tab) => {
  try {
    const text = await keyboardCommandHandler.handleCommand(command, tab);
    await clipboardService.copy(text, tab);
    await badgeService.showSuccess();
    return true;
  } catch (e) {
    console.error(e);
    await badgeService.showError();
    throw e;
  }
});

// listen to messages from popup
// NOTE: async function will not work here
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle badge messages directly in background.ts
  if (message.topic === 'badge') {
    if (message.params.type === 'success') {
      badgeService.showSuccess()
        .then(() => sendResponse({ ok: true, text: null }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
    } else {
      badgeService.showError()
        .then(() => sendResponse({ ok: true, text: null }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
    }
    return true;
  }

  // Handle export messages via service
  runtimeMessageHandler
    .handleMessage(message.topic, message.params)
    .then(text => sendResponse({ ok: true, text }))
    .catch(error => sendResponse({ ok: false, error: error.message }));

  // Must return true to indicate async. See https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
  return true;
});

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.entries(changes)
    .filter(([key]) => Settings.keys.includes(key))
    .length > 0;
  if (hasSettingsChanged) {
    await refreshMarkdownInstance();
  }
});

refreshMarkdownInstance()
  .then(() => null /* NOP */);
