/**
 * Service for handling keyboard command shortcuts
 */

import type { HandlerCore } from './handler-core.js';
import { parseCustomFormatCommand } from './handler-core.js';

export interface TabsAPI {
  query: (queryInfo: { currentWindow: true; active: true }) => Promise<browser.tabs.Tab[]>;
}

export interface KeyboardCommandHandler {
  /**
   * Handle a keyboard command
   * @param command - The command string from browser.commands.onCommand
   * @param tab - The active tab (may be undefined on Firefox)
   * @returns The text to copy to clipboard
   */
  handleCommand: (command: string, tab?: browser.tabs.Tab) => Promise<string>;
}

// Command lookup table for tab export commands
const TAB_EXPORT_COMMANDS: Record<string, { scope: 'all' | 'highlighted'; format: 'link' | 'title' | 'url'; listType: 'list' | 'task-list' }> = {
  'all-tabs-link-as-list': { scope: 'all', format: 'link', listType: 'list' },
  'all-tabs-link-as-task-list': { scope: 'all', format: 'link', listType: 'task-list' },
  'all-tabs-title-as-list': { scope: 'all', format: 'title', listType: 'list' },
  'all-tabs-url-as-list': { scope: 'all', format: 'url', listType: 'list' },
  'highlighted-tabs-link-as-list': { scope: 'highlighted', format: 'link', listType: 'list' },
  'highlighted-tabs-link-as-task-list': { scope: 'highlighted', format: 'link', listType: 'task-list' },
  'highlighted-tabs-title-as-list': { scope: 'highlighted', format: 'title', listType: 'list' },
  'highlighted-tabs-url-as-list': { scope: 'highlighted', format: 'url', listType: 'list' },
};

export function createKeyboardCommandHandler(
  tabsAPI: TabsAPI,
  handlerCore: HandlerCore,
): KeyboardCommandHandler {
  async function mustGetCurrentTab(providedTab?: browser.tabs.Tab): Promise<browser.tabs.Tab> {
    if (providedTab) {
      return providedTab;
    }

    // Note: tab argument may be undefined on Firefox.
    // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/commands/onCommand
    const tabs = await tabsAPI.query({
      currentWindow: true,
      active: true,
    });
    if (tabs.length !== 1) {
      throw new Error('failed to get current tab');
    }
    return tabs[0]!;
  }

  async function handleCommand_(command: string, tab?: browser.tabs.Tab): Promise<string> {
    const currentTab = await mustGetCurrentTab(tab);
    const windowId = currentTab.windowId;
    if (windowId === undefined) {
      throw new Error('tab has no windowId');
    }

    // Handle special commands
    if (command === 'selection-as-markdown') {
      return handlerCore.convertSelection(currentTab);
    }

    if (command === 'current-tab-link') {
      return handlerCore.exportSingleLink({
        format: 'link',
        title: currentTab.title || '',
        url: currentTab.url || '',
      });
    }

    // Check if command is in the tab export lookup table
    if (command in TAB_EXPORT_COMMANDS) {
      const params = TAB_EXPORT_COMMANDS[command]!;
      return handlerCore.exportMultipleTabs({
        ...params,
        windowId,
      });
    }

    // Try to parse as custom format command
    try {
      const { context, slot } = parseCustomFormatCommand(command, ['current-tab', 'all-tabs', 'highlighted-tabs'] as const);

      switch (context) {
        case 'current-tab':
          return handlerCore.exportSingleLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: currentTab.title || '',
            url: currentTab.url || '',
          });

        case 'all-tabs':
          return handlerCore.exportMultipleTabs({
            scope: 'all',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });

        case 'highlighted-tabs':
          return handlerCore.exportMultipleTabs({
            scope: 'highlighted',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });

        default:
          throw new TypeError(`unknown keyboard custom format context: ${context}`);
      }
    } catch (error) {
      // If it's not a custom format command, throw unknown command error
      if (error instanceof TypeError && error.message.includes('unknown custom format command')) {
        throw new TypeError(`unknown keyboard command: ${command}`);
      }
      throw error;
    }
  }

  return {
    handleCommand: handleCommand_,
  };
}

export function createKeyboardBrowserCommandHandler(
  handlerCore: HandlerCore,
): KeyboardCommandHandler {
  return createKeyboardCommandHandler(
    browser.tabs,
    handlerCore,
  );
}
