/**
 * Service for handling keyboard command shortcuts
 */

import type { TabExportService } from './tab-export-service.js';
import type { LinkExportService } from './link-export-service.js';
import type { SelectionConverterService } from './selection-converter-service.js';

export interface TabsAPI {
  query: (queryInfo: { currentWindow: true; active: true }) => Promise<browser.tabs.Tab[]>;
}

export interface CommandHandlerService {
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

export function createCommandHandlerService(
  tabsAPI: TabsAPI,
  selectionConverterService: SelectionConverterService,
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
): CommandHandlerService {
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

  function parseCustomFormatCommand(command: string): { context: 'current-tab' | 'all-tabs' | 'highlighted-tabs'; slot: string } {
    const match = /(current-tab|all-tabs|highlighted-tabs)-custom-format-(\d)/.exec(command);
    if (match === null) {
      throw new TypeError(`unknown custom format command: ${command}`);
    }
    const context = match[1] as 'current-tab' | 'all-tabs' | 'highlighted-tabs';
    const slot = match[2]!;
    return { context, slot };
  }

  async function handleCommand_(command: string, tab?: browser.tabs.Tab): Promise<string> {
    const currentTab = await mustGetCurrentTab(tab);
    const windowId = currentTab.windowId;
    if (windowId === undefined) {
      throw new Error('tab has no windowId');
    }

    // Handle special commands
    if (command === 'selection-as-markdown') {
      return selectionConverterService.convertSelectionToMarkdown(currentTab);
    }

    if (command === 'current-tab-link') {
      return linkExportService.exportLink({
        format: 'link',
        title: currentTab.title || '',
        url: currentTab.url || '',
      });
    }

    // Check if command is in the tab export lookup table
    if (command in TAB_EXPORT_COMMANDS) {
      const params = TAB_EXPORT_COMMANDS[command]!;
      return tabExportService.exportTabs({
        ...params,
        windowId,
      });
    }

    // Try to parse as custom format command
    try {
      const { context, slot } = parseCustomFormatCommand(command);

      switch (context) {
        case 'current-tab':
          return linkExportService.exportLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: currentTab.title || '',
            url: currentTab.url || '',
          });

        case 'all-tabs':
          return tabExportService.exportTabs({
            scope: 'all',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });

        case 'highlighted-tabs':
          return tabExportService.exportTabs({
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

export function createBrowserCommandHandlerService(
  selectionConverterService: SelectionConverterService,
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
): CommandHandlerService {
  return createCommandHandlerService(
    browser.tabs,
    selectionConverterService,
    linkExportService,
    tabExportService,
  );
}
