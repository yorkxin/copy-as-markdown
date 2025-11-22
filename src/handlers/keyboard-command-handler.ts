/**
 * Service for handling keyboard command shortcuts
 */

import { KeyboardCommandIds } from '../contracts/commands.js';
import type { KeyboardCommandId } from '../contracts/commands.js';
import type { LinkExportService } from '../services/link-export-service.js';
import type { SelectionConverterService } from '../services/selection-converter-service.js';
import type { TabExportService } from '../services/tab-export-service.js';
import type { TabsAPI } from '../services/shared-types.js';
import { mustGetCurrentTab, parseCustomFormatCommand, requireWindowId } from '../services/browser-utils.js';

export interface KeyboardCommandHandler {
  /**
   * Handle a keyboard command
   * @param command - The command string from browser.commands.onCommand
   * @param tab - The active tab (may be undefined on Firefox)
   * @returns The text to copy to clipboard
   */
  handleCommand: (command: KeyboardCommandId, tab?: browser.tabs.Tab) => Promise<string>;
}

// Command lookup table for tab export commands
type TabExportCommandId
  = | typeof KeyboardCommandIds.AllTabsLinkAsList
    | typeof KeyboardCommandIds.AllTabsLinkAsTaskList
    | typeof KeyboardCommandIds.AllTabsTitleAsList
    | typeof KeyboardCommandIds.AllTabsUrlAsList
    | typeof KeyboardCommandIds.HighlightedTabsLinkAsList
    | typeof KeyboardCommandIds.HighlightedTabsLinkAsTaskList
    | typeof KeyboardCommandIds.HighlightedTabsTitleAsList
    | typeof KeyboardCommandIds.HighlightedTabsUrlAsList;

const TAB_EXPORT_COMMANDS: Record<TabExportCommandId, { scope: 'all' | 'highlighted'; format: 'link' | 'title' | 'url'; listType: 'list' | 'task-list' }> = {
  [KeyboardCommandIds.AllTabsLinkAsList]: { scope: 'all', format: 'link', listType: 'list' },
  [KeyboardCommandIds.AllTabsLinkAsTaskList]: { scope: 'all', format: 'link', listType: 'task-list' },
  [KeyboardCommandIds.AllTabsTitleAsList]: { scope: 'all', format: 'title', listType: 'list' },
  [KeyboardCommandIds.AllTabsUrlAsList]: { scope: 'all', format: 'url', listType: 'list' },
  [KeyboardCommandIds.HighlightedTabsLinkAsList]: { scope: 'highlighted', format: 'link', listType: 'list' },
  [KeyboardCommandIds.HighlightedTabsLinkAsTaskList]: { scope: 'highlighted', format: 'link', listType: 'task-list' },
  [KeyboardCommandIds.HighlightedTabsTitleAsList]: { scope: 'highlighted', format: 'title', listType: 'list' },
  [KeyboardCommandIds.HighlightedTabsUrlAsList]: { scope: 'highlighted', format: 'url', listType: 'list' },
};

export function createKeyboardCommandHandler(
  tabsAPI: TabsAPI,
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
    selectionConverterService: SelectionConverterService;
  },
): KeyboardCommandHandler {
  async function handleCommand_(command: KeyboardCommandId, tab?: browser.tabs.Tab): Promise<string> {
    const currentTab = await mustGetCurrentTab(tabsAPI, tab);
    const windowId = requireWindowId(currentTab);

    // Handle special commands
    if (command === KeyboardCommandIds.SelectionAsMarkdown) {
      return services.selectionConverterService.convertSelectionToMarkdown(currentTab);
    }

    if (command === KeyboardCommandIds.CurrentTabLink) {
      return services.linkExportService.exportLink({
        format: 'link',
        title: currentTab.title || '',
        url: currentTab.url || '',
      });
    }

    // Check if command is in the tab export lookup table
    if (command in TAB_EXPORT_COMMANDS) {
      const params = TAB_EXPORT_COMMANDS[command as TabExportCommandId]!;
      return services.tabExportService.exportTabs({
        ...params,
        windowId,
      });
    }

    // Try to parse as custom format command
    try {
      const { context, slot } = parseCustomFormatCommand(command, ['current-tab', 'all-tabs', 'highlighted-tabs'] as const);

      switch (context) {
        case 'current-tab':
          return services.linkExportService.exportLink({
            format: 'custom-format',
            customFormatSlot: slot,
            title: currentTab.title || '',
            url: currentTab.url || '',
          });

        case 'all-tabs':
          return services.tabExportService.exportTabs({
            scope: 'all',
            format: 'custom-format',
            customFormatSlot: slot,
            windowId,
          });

        case 'highlighted-tabs':
          return services.tabExportService.exportTabs({
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
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
    selectionConverterService: SelectionConverterService;
  },
): KeyboardCommandHandler {
  return createKeyboardCommandHandler(
    browser.tabs,
    services,
  );
}
