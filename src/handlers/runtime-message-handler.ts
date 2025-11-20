/**
 * Service for handling runtime messages from popup and other extension pages
 */

import type { LinkExportService } from '../services/link-export-service.js';
import type { TabExportService } from '../services/tab-export-service.js';
import type { TabsAPI } from '../services/shared-types.js';

export interface RuntimeMessageHandler {
  /**
   * Handle a runtime message
   * @param topic - The message topic
   * @param params - The message parameters
   * @returns The result text, or null if no result
   */
  handleMessage: (topic: string, params: any) => Promise<string | null>;
}

export function createRuntimeMessageHandler(
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
  },
  tabsAPI: TabsAPI,
): RuntimeMessageHandler {
  async function handleMessage_(topic: string, params: any): Promise<string | null> {
    switch (topic) {
      case 'export-current-tab': {
        if (!tabsAPI.get) {
          throw new Error('tabsAPI.get is unavailable');
        }
        const tab = await tabsAPI.get(params.tabId);
        if (typeof tab === 'undefined') {
          throw new TypeError('got undefined tab');
        }
        return services.linkExportService.exportLink({
          format: params.format,
          customFormatSlot: params.customFormatSlot,
          title: tab.title || '',
          url: tab.url || '',
        });
      }

      case 'export-tabs': {
        return services.tabExportService.exportTabs(params);
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

export function createBrowserRuntimeMessageHandler(
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
  },
): RuntimeMessageHandler {
  return createRuntimeMessageHandler(
    services,
    browser.tabs,
  );
}
