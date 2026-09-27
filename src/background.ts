import './ensure-browser-global.js'; // Installs `browser` before dependent modules evaluate.
import type { SelectionMarkdownSettings } from './lib/selection-settings.js';
import SelectionSettings from './lib/selection-settings.js';
import type { MarkdownSettings } from './lib/markdown-settings.js';
import { loadMarkdownSettings, markdownSettingsKeys, readMarkdownSettings } from './lib/markdown-settings.js';
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

// Link and tab exports share this instance; Copy Selection has separate settings.
const markdownInstance = new Markdown();
let selectionSettings: SelectionMarkdownSettings = SelectionSettings.defaultSettings;
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

const badgeService = createBrowserBadgeService();
const contextMenuService = createBrowserContextMenuService(CustomFormatsStorage, BuiltInStyleSettings);
const tabExportService = createBrowserTabExportService(markdownInstance, CustomFormatsStorage);
const linkExportService = new LinkExportService(markdownInstance, CustomFormatsStorage);

const pendingPopupFeedbackService = createBrowserPendingPopupFeedbackService();
const EMPTY_RESULT_FEEDBACK: PendingPopupFeedbackCode = 'empty-result';

// Chrome shares one offscreen document for clipboard writes and DOM conversion;
// Firefox uses navigator.clipboard and its DOM-bearing Event Page.
const offscreenDocumentService = BUILD_TARGET === 'firefox-mv3'
  ? null
  : createBrowserOffscreenDocumentService();

const realClipboard: ClipboardService = BUILD_TARGET === 'firefox-mv3'
  ? createNavigatorClipboardService(navigator.clipboard)
  : createOffscreenClipboardService(offscreenDocumentService!);

const clipboardService = createBrowserClipboardServiceController(realClipboard);

if (BUILD_PROFILE === 'e2e') {
  (globalThis as any).setMockClipboardMode = clipboardService.setMockMode;

  clipboardService.initializeMockState()
    .catch(error => console.error('Mock clipboard init error', error));
}

const markdownConverter: MarkdownConverter = BUILD_TARGET === 'firefox-mv3'
  ? createEventPageMarkdownConverter()
  : createOffscreenMarkdownConverter(offscreenDocumentService!);

const selectionConverterService = createBrowserSelectionConverterService(
  {
    getTurndownOptions: () => ({
      headingStyle: 'atx',
      ...selectionSettings,
    }),
  },
  markdownConverter,
);

const handlerServices = {
  linkExportService,
  tabExportService,
  selectionConverterService,
};

const keyboardCommandHandler = createKeyboardBrowserCommandHandler(handlerServices);

const contextMenuHandler = createBrowserContextMenuHandler(
  handlerServices,
  bookmarks,
);

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

function applyMarkdownSettings(settings: MarkdownSettings): void {
  markdownInstance.alwaysEscapeLinkBracket = settings.alwaysEscapeLinkBrackets;
  markdownInstance.bulletListMarker = settings.multipleLinks.bulletListMarker;
  markdownInstance.indentationStyle = settings.multipleLinks.tabGroupIndentation;
  selectionSettings = settings.selection;
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

contextMenuService.createAll().then(() => null);
browser.storage.sync.onChanged.addListener(async (changes) => {
  const changedKeys = Object.keys(changes);
  const hasCustomFormatUpdate = changedKeys.includes(CustomFormatsStorage.KeyOfLastUpdate());
  const hasBuiltInStylesUpdate = changedKeys.some(key => BuiltInStyleSettings.keys.includes(key));

  if (hasCustomFormatUpdate || hasBuiltInStylesUpdate) {
    await contextMenuService.createAll();
  }
});

// MV3 requires service-worker listeners to register synchronously during module evaluation.
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

// A non-async listener can keep the sendResponse channel open by returning true.
// https://developer.chrome.com/docs/extensions/develop/concepts/messaging#simple
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const runtimeMessage = message as RuntimeMessage;
  if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'e2e-listeners-ready') {
    // Delivery waits for synchronous module evaluation, so reaching this branch
    // proves the listeners above and the final readiness flag are initialized.
    sendResponse({ ok: true, listenersReady: (globalThis as any).__listenersReady === true });
    return true;
  }

  if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'check-mock-clipboard') {
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

  if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'set-mock-clipboard') {
    clipboardService.setMockMode(runtimeMessage.params?.enabled === true)
      .then(() => sendResponse({ ok: true, text: null }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  runtimeMessageHandler
    .handleMessage(runtimeMessage)
    .then(text => sendResponse({ ok: true, text }))
    .catch(error => sendResponse({ ok: false, error: error.message }));

  return true;
});

// Startup migration has completed, so settings changes only require a re-read.
browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes)
    .some(key => markdownSettingsKeys.includes(key));
  if (!hasSettingsChanged) {
    return;
  }

  await readMarkdownSettings()
    .then(applyMarkdownSettings)
    .catch(error => console.error('error getting settings', error));
});

// Startup migration runs even when no options page is opened.
loadMarkdownSettings()
  .then(applyMarkdownSettings)
  .catch(error => console.error('error getting settings', error));

if (BUILD_PROFILE === 'e2e') {
  // This flag becomes true only after every listener is registered, including after restarts.
  (globalThis as any).__listenersReady = true;
}
