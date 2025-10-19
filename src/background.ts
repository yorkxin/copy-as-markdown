import Settings from './lib/settings.js';
import Markdown from './lib/markdown.js';
import { Bookmarks } from './bookmarks.js';
import CustomFormatsStorage from './storage/custom-formats-storage.js';
import { createBrowserBadgeService } from './services/badge-service.js';
import { createBrowserContextMenuService } from './services/context-menu-service.js';
import { createBrowserTabExportService } from './services/tab-export-service.js';
import { createBrowserClipboardService } from './services/clipboard-service.js';
import { createBrowserLinkExportService } from './services/link-export-service.js';
import { createBrowserSelectionConverterService } from './services/selection-converter-service.js';
import { createBrowserCommandHandlerService } from './services/command-handler-service.js';

type CustomFormatSubject = 'all-tabs' | 'highlighted-tabs' | 'current-tab' | 'link';

const ALARM_REFRESH_MENU = 'refreshMenu';

// Initialize markdown and bookmarks
const markdownInstance = new Markdown();
const bookmarks = new Bookmarks({
  markdown: markdownInstance,
});

// Initialize services
const badgeService = createBrowserBadgeService();
const contextMenuService = createBrowserContextMenuService(CustomFormatsStorage);
const tabExportService = createBrowserTabExportService(markdownInstance, CustomFormatsStorage);
const linkExportService = createBrowserLinkExportService(markdownInstance, CustomFormatsStorage);

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

// Command handler service
const commandHandlerService = createBrowserCommandHandlerService(
  selectionConverterService,
  linkExportService,
  tabExportService,
);

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

function parseCustomFormatCommand(command: string): { context: CustomFormatSubject; slot: string } {
  const match = /(all-tabs|highlighted-tabs|current-tab|link)-custom-format-(\d)/.exec(command);
  if (match === null) {
    throw new TypeError(`unknown command: ${command}`);
  }
  const context = match[1] as CustomFormatSubject;
  const slot = match[2]!;
  return {
    context,
    slot,
  };
}

async function handleCustomFormatLink(slot: string, menuInfo: browser.contextMenus.OnClickData): Promise<string> {
  // linkText for Firefox (as of 2018/03/07)
  // selectionText for Chrome on Mac only. On Windows it does not highlight text when
  // right-click.
  // TODO: use linkText when Chrome supports it on stable.
  const linkText = menuInfo.selectionText || menuInfo.linkText || '';

  return handleExportLink({
    format: 'custom-format',
    customFormatSlot: slot,
    title: linkText,
    url: menuInfo.linkUrl || '',
  });
}

// context menu handler. In case of bookmark, tab can be undeefined.
async function handleContentOfContextMenu(
  info: browser.contextMenus.OnClickData,
  tab: browser.tabs.Tab | undefined,
): Promise<string> {
  let text: string;

  switch (info.menuItemId) {
    case 'current-tab': {
      text = markdownInstance.linkTo(tab!.title || '', tab!.url || '');
      break;
    }

    case 'link': {
      /* <a href="linkURL"><img src="srcURL" /></a> */
      if (info.mediaType === 'image') {
        // TODO: extract image alt text
        text = Markdown.linkedImage('', info.srcUrl || '', info.linkUrl || '');
        break;
      }

      /* <a href="linkURL">Text</a> */

      // linkText for Firefox (as of 2018/03/07)
      // selectionText for Chrome on Mac only. On Windows it does not highlight text when
      // right-click.
      // TODO: use linkText when Chrome supports it on stable.
      const linkText = info.selectionText || info.linkText || '';

      text = markdownInstance.linkTo(linkText, info.linkUrl || '');
      break;
    }

    case 'image': {
      // TODO: extract image alt text
      text = Markdown.imageFor('', info.srcUrl || '');
      break;
    }

    case 'selection-as-markdown': {
      text = await selectionConverterService.convertSelectionToMarkdown(tab!);
      break;
    }

    // Only available on Firefox
    case 'all-tabs-list': {
      if (tab!.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await tabExportService.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: tab!.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'all-tabs-task-list': {
      if (tab!.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await tabExportService.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'task-list',
        windowId: tab!.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-list': {
      if (tab!.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await tabExportService.exportTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'list',
        windowId: tab!.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'highlighted-tabs-task-list': {
      if (tab!.windowId === undefined) {
        throw new Error('tab has no windowId');
      }
      text = await tabExportService.exportTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'task-list',
        windowId: tab!.windowId,
      });
      break;
    }

    // Only available on Firefox
    case 'bookmark-link': {
      const bm = await browser.bookmarks.getSubTree(info.bookmarkId!);
      if (bm.length === 0) {
        throw new Error('bookmark not found');
      }
      text = bookmarks.toMarkdown(bm[0]!);
      break;
    }

    default: {
      const {
        context,
        slot,
      } = parseCustomFormatCommand(info.menuItemId.toString());

      switch (context) {
        case 'current-tab': {
          text = await handleExportLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: tab!.title || '',
            url: tab!.url || '',
          });
          break;
        }
        case 'link': {
          text = await handleCustomFormatLink(slot, info);
          break;
        }
        case 'all-tabs': {
          if (tab!.windowId === undefined) {
            throw new Error('tab has no windowId');
          }
          text = await tabExportService.exportTabs({
            scope: 'all',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId: tab!.windowId,
          });
          break;
        }
        case 'highlighted-tabs': {
          if (tab!.windowId === undefined) {
            throw new Error('tab has no windowId');
          }
          text = await tabExportService.exportTabs({
            scope: 'highlighted',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId: tab!.windowId,
          });
          break;
        }
        default:
          throw new TypeError(`unknown context menu custom format: ${info.menuItemId}`);
      }
    }
  }
  return text;
}

async function handleExportLink({
  format,
  customFormatSlot,
  title,
  url,
}: {
  format: 'link' | 'custom-format';
  customFormatSlot?: string | null;
  title: string;
  url: string;
}): Promise<string> {
  return linkExportService.exportLink({
    format,
    title,
    url,
    customFormatSlot,
  });
}

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
    const text = await handleContentOfContextMenu(info, tab);
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
    const text = await commandHandlerService.handleCommand(command, tab);
    await clipboardService.copy(text, tab);
    await badgeService.showSuccess();
    return true;
  } catch (e) {
    console.error(e);
    await badgeService.showError();
    throw e;
  }
});

async function handleRuntimeMessage(
  topic: 'badge' | 'export-current-tab' | 'export-tabs',
  params: any,
): Promise<string | null> {
  switch (topic) {
    case 'badge': {
      if (params.type === 'success') {
        await badgeService.showSuccess();
      } else {
        await badgeService.showError();
      }
      return null;
    }

    case 'export-current-tab': {
      const tab = await browser.tabs.get(params.tabId);
      if (typeof tab === 'undefined') {
        throw new TypeError('got undefined tab');
      }
      return handleExportLink({
        format: params.format,
        customFormatSlot: params.customFormatSlot,
        title: tab.title || '',
        url: tab.url || '',
      });
    }

    case 'export-tabs': {
      return tabExportService.exportTabs(params);
    }

    default: {
      throw new TypeError(`Unknown message topic '${topic}'`);
    }
  }
}

// listen to messages from popup
// NOTE: async function will not work here
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleRuntimeMessage(message.topic, message.params)
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
