import './ensure-browser-global.js'; // MUST be first — defines `browser` for the service worker.
import Settings from './lib/settings.js';
import type { CodeBlockStyle } from './lib/settings.js';
import Markdown from './lib/markdown.js';
import { Bookmarks } from './bookmarks.js';
import BuiltInStyleSettings from './lib/built-in-style-settings.js';
import CustomFormatsStorage from './storage/custom-formats-storage.js';
import { createBrowserBadgeService } from './services/badge-service.js';
import { createBrowserContextMenuService } from './services/context-menu-service.js';
import { createBrowserTabExportService } from './services/tab-export-service.js';
import {
  createBrowserClipboardServiceController,
  createNavigatorClipboardService,
} from './services/clipboard-service.js';
import type { ClipboardService } from './services/clipboard-service.js';
import { createOffscreenClipboardService } from './services/offscreen-clipboard-service.js';
import { LinkExportService } from './services/link-export-service.js';
import { createBrowserSelectionConverterService } from './services/selection-converter-service.js';
import { createBrowserOffscreenDocumentService } from './services/offscreen-document-service.js';
import {
  createEventPageMarkdownConverter,
  createOffscreenMarkdownConverter,
} from './services/markdown-converter.js';
import type { MarkdownConverter } from './services/markdown-converter.js';
import { createBrowserPendingPopupFeedbackService } from './services/pending-popup-feedback-service.js';
import { createKeyboardBrowserCommandHandler } from './handlers/keyboard-command-handler.js';
import { createBrowserContextMenuHandler } from './handlers/context-menu-handler.js';
import { createBrowserRuntimeMessageHandler } from './handlers/runtime-message-handler.js';
import type { KeyboardCommandId } from './contracts/commands.js';
import type { PendingPopupFeedbackCode, RuntimeMessage } from './contracts/messages.js';

// Initialize markdown and bookmarks
const markdownInstance = new Markdown();
let selectionCodeBlockStyle: CodeBlockStyle = 'fenced';
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

// Initialize services
const badgeService = createBrowserBadgeService();
const contextMenuService = createBrowserContextMenuService(CustomFormatsStorage, BuiltInStyleSettings);
const tabExportService = createBrowserTabExportService(markdownInstance, CustomFormatsStorage);
const linkExportService = new LinkExportService(markdownInstance, CustomFormatsStorage);

const pendingPopupFeedbackService = createBrowserPendingPopupFeedbackService();
const EMPTY_RESULT_FEEDBACK: PendingPopupFeedbackCode = 'empty-result';

// Chrome shares ONE offscreen document between clipboard writes and Markdown
// conversion. Firefox has no offscreen API (navigator.clipboard + Event Page).
const offscreenDocumentService = BUILD_TARGET === 'firefox-mv3'
  ? null
  : createBrowserOffscreenDocumentService();

const realClipboard: ClipboardService = BUILD_TARGET === 'firefox-mv3'
  ? createNavigatorClipboardService(navigator.clipboard)
  : createOffscreenClipboardService(offscreenDocumentService!);

const clipboardService = createBrowserClipboardServiceController(realClipboard);

(globalThis as any).setMockClipboardMode = clipboardService.setMockMode;

clipboardService.initializeMockState()
  .catch(error => console.error('Mock clipboard init error', error));

const markdownConverter: MarkdownConverter = BUILD_TARGET === 'firefox-mv3'
  ? createEventPageMarkdownConverter()
  : createOffscreenMarkdownConverter(offscreenDocumentService!);

const selectionConverterService = createBrowserSelectionConverterService(
  {
    getTurndownOptions: () => ({
      headingStyle: 'atx',
      bulletListMarker: markdownInstance.unorderedListChar,
      codeBlockStyle: selectionCodeBlockStyle,
    }),
  },
  markdownConverter,
);

const handlerServices = {
  linkExportService,
  tabExportService,
  selectionConverterService,
};

// Keyboard command handler
const keyboardCommandHandler = createKeyboardBrowserCommandHandler(handlerServices);

// Context menu handler
const contextMenuHandler = createBrowserContextMenuHandler(
  handlerServices,
  bookmarks,
);

// Runtime message handler
const runtimeMessageHandler = createBrowserRuntimeMessageHandler(handlerServices);

async function setPendingPopupFeedback(feedback: PendingPopupFeedbackCode): Promise<void> {
  try {
    await pendingPopupFeedbackService.set(feedback);
    await badgeService.showWarning();
  } catch (error) {
    console.error('Failed to persist pending popup feedback', error);
  }
}

async function clearPendingPopupFeedback(): Promise<void> {
  try {
    await pendingPopupFeedbackService.clear();
    await badgeService.clear();
  } catch (error) {
    console.error('Failed to clear pending popup feedback', error);
  }
}

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
  selectionCodeBlockStyle = settings.styleOfCodeBlock;
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === badgeService.getClearAlarmName()) {
    const pendingPopupFeedback = await pendingPopupFeedbackService.get();
    if (pendingPopupFeedback) {
      await badgeService.showWarning();
    } else {
      await badgeService.clear();
    }
  }
});

browser.runtime.onStartup.addListener(async () => {
  await clearPendingPopupFeedback();
});

contextMenuService.createAll().then(() => null /* NOP */);
browser.storage.sync.onChanged.addListener(async (changes) => {
  const changedKeys = Object.keys(changes);
  const hasCustomFormatUpdate = changedKeys.includes(CustomFormatsStorage.KeyOfLastUpdate());
  const hasBuiltInStylesUpdate = changedKeys.some(key => BuiltInStyleSettings.keys.includes(key));

  if (hasCustomFormatUpdate || hasBuiltInStylesUpdate) {
    await contextMenuService.createAll();
  }
});

// NOTE: All listeners must be registered at top level scope.

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const text = await contextMenuHandler.handleMenuClick(info, tab);
    const didCopy = await clipboardService.copy(text);
    if (didCopy) {
      await clearPendingPopupFeedback();
      await badgeService.showSuccess();
    } else {
      await setPendingPopupFeedback(EMPTY_RESULT_FEEDBACK);
    }
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
    const text = await keyboardCommandHandler.handleCommand(command as KeyboardCommandId, tab);
    const didCopy = await clipboardService.copy(text);
    if (didCopy) {
      await clearPendingPopupFeedback();
      await badgeService.showSuccess();
    } else {
      await setPendingPopupFeedback(EMPTY_RESULT_FEEDBACK);
    }
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
  const runtimeMessage = message as RuntimeMessage;
  // Handle check-mock-clipboard message from popup
  if (runtimeMessage.topic === 'check-mock-clipboard') {
    sendResponse({ ok: true, text: clipboardService.isMockMode() ? 'true' : 'false' });
    return true;
  }

  if (runtimeMessage.topic === 'consume-pending-popup-feedback') {
    pendingPopupFeedbackService.consume()
      .then(async (feedback) => {
        if (feedback) {
          await badgeService.clear();
        }
        sendResponse({ ok: true, feedback });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Handle badge messages directly in background.ts
  if (runtimeMessage.topic === 'badge') {
    if (runtimeMessage.params.type === 'success') {
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

  // Handle copy-to-clipboard message from popup
  if (runtimeMessage.topic === 'copy-to-clipboard') {
    const text = runtimeMessage.params.text;
    clipboardService.copy(text)
      .then(async (didCopy) => {
        if (didCopy) {
          await clearPendingPopupFeedback();
        }
        sendResponse({ ok: true, text: null, copied: didCopy });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (runtimeMessage.topic === 'set-mock-clipboard') {
    clipboardService.setMockMode(runtimeMessage.params?.enabled === true)
      .then(() => sendResponse({ ok: true, text: null }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Handle export messages via service
  runtimeMessageHandler
    .handleMessage(runtimeMessage)
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

// All MV3 event listeners above are registered synchronously at top-level scope.
// Flip this flag last so e2e's getServiceWorker() can gate on "listeners wired"
// rather than merely "chrome.* API exists" — closing the readiness race where a
// test dispatched an event before onCommand/onClicked/onMessage were registered.
// Re-set on every worker restart because the module body re-runs each time.
(globalThis as any).__listenersReady = true;
