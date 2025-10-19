/**
 * Service for handling runtime messages from popup and other extension pages
 */

import type { BadgeService } from './badge-service.js';
import type { LinkExportService } from './link-export-service.js';
import type { TabExportService } from './tab-export-service.js';

export interface TabsAPI {
  get: (tabId: number) => Promise<browser.tabs.Tab>;
}

export interface RuntimeMessageHandlerService {
  /**
   * Handle a runtime message
   * @param topic - The message topic
   * @param params - The message parameters
   * @returns The result text, or null if no result
   */
  handleMessage: (topic: string, params: any) => Promise<string | null>;
}

export function createRuntimeMessageHandlerService(
  badgeService: BadgeService,
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
  tabsAPI: TabsAPI,
): RuntimeMessageHandlerService {
  async function handleMessage_(topic: string, params: any): Promise<string | null> {
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
        const tab = await tabsAPI.get(params.tabId);
        if (typeof tab === 'undefined') {
          throw new TypeError('got undefined tab');
        }
        return linkExportService.exportLink({
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

  return {
    handleMessage: handleMessage_,
  };
}

export function createBrowserRuntimeMessageHandlerService(
  badgeService: BadgeService,
  linkExportService: LinkExportService,
  tabExportService: TabExportService,
): RuntimeMessageHandlerService {
  return createRuntimeMessageHandlerService(
    badgeService,
    linkExportService,
    tabExportService,
    browser.tabs,
  );
}
