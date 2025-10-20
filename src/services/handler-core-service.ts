/**
 * Core service for handling common operations across all handler types
 * (command, context menu, runtime message handlers)
 */

import type { LinkExportService } from './link-export-service.js';
import type { TabExportService } from './tab-export-service.js';
import type { SelectionConverterService } from './selection-converter-service.js';
import type { BadgeService } from './badge-service.js';
import Markdown from '../lib/markdown.js';

/**
 * Parse a custom format command to extract context and slot number
 * @param command - Command string like "current-tab-custom-format-1"
 * @param contexts - Valid context names for this command type
 * @returns Object with context and slot
 * @throws TypeError if command format is invalid
 */
export function parseCustomFormatCommand<T extends string>(
  command: string,
  contexts: readonly T[],
): { context: T; slot: string } {
  const contextPattern = contexts.join('|');
  const regex = new RegExp(`(${contextPattern})-custom-format-(\\d)`);
  const match = regex.exec(command);

  if (match === null) {
    throw new TypeError(`unknown custom format command: ${command}`);
  }

  const context = match[1] as T;
  const slot = match[2]!;
  return { context, slot };
}

export interface HandlerCoreService {
  /**
   * Export a single link (current tab or link from context menu)
   */
  exportSingleLink: (options: {
    format: 'link' | 'custom-format';
    customFormatSlot?: string;
    title: string;
    url: string;
  }) => Promise<string>;

  /**
   * Export multiple tabs
   */
  exportMultipleTabs: (options: {
    scope: 'all' | 'highlighted';
    format: 'link' | 'title' | 'url' | 'custom-format';
    customFormatSlot?: string;
    listType?: 'list' | 'task-list';
    windowId: number;
  }) => Promise<string>;

  /**
   * Convert selection to markdown
   */
  convertSelection: (tab: browser.tabs.Tab) => Promise<string>;

  /**
   * Show success badge
   */
  showSuccessBadge: () => Promise<void>;

  /**
   * Show error badge
   */
  showErrorBadge: () => Promise<void>;

  /**
   * Format an image in markdown syntax
   */
  formatImage: (alt: string, url: string) => string;

  /**
   * Format a linked image in markdown syntax
   */
  formatLinkedImage: (alt: string, imageUrl: string, linkUrl: string) => string;
}

export function createHandlerCoreService(
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
  selectionConverterService: SelectionConverterService,
  badgeService: BadgeService,
): HandlerCoreService {
  async function exportSingleLink_(options: {
    format: 'link' | 'custom-format';
    customFormatSlot?: string;
    title: string;
    url: string;
  }): Promise<string> {
    return linkExportService.exportLink({
      format: options.format,
      customFormatSlot: options.customFormatSlot,
      title: options.title,
      url: options.url,
    });
  }

  async function exportMultipleTabs_(options: {
    scope: 'all' | 'highlighted';
    format: 'link' | 'title' | 'url' | 'custom-format';
    customFormatSlot?: string;
    listType?: 'list' | 'task-list';
    windowId: number;
  }): Promise<string> {
    return tabExportService.exportTabs(options);
  }

  async function convertSelection_(tab: browser.tabs.Tab): Promise<string> {
    return selectionConverterService.convertSelectionToMarkdown(tab);
  }

  async function showSuccessBadge_(): Promise<void> {
    return badgeService.showSuccess();
  }

  async function showErrorBadge_(): Promise<void> {
    return badgeService.showError();
  }

  function formatImage_(alt: string, url: string): string {
    return Markdown.imageFor(alt, url);
  }

  function formatLinkedImage_(alt: string, imageUrl: string, linkUrl: string): string {
    return Markdown.linkedImage(alt, imageUrl, linkUrl);
  }

  return {
    exportSingleLink: exportSingleLink_,
    exportMultipleTabs: exportMultipleTabs_,
    convertSelection: convertSelection_,
    showSuccessBadge: showSuccessBadge_,
    showErrorBadge: showErrorBadge_,
    formatImage: formatImage_,
    formatLinkedImage: formatLinkedImage_,
  };
}

export function createBrowserHandlerCoreService(
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
  selectionConverterService: SelectionConverterService,
  badgeService: BadgeService,
): HandlerCoreService {
  return createHandlerCoreService(
    linkExportService,
    tabExportService,
    selectionConverterService,
    badgeService,
  );
}
