/**
 * Service for handling runtime messages from popup and other extension pages
 */

import type { RuntimeMessage } from '../contracts/messages.js';
import type { LinkExportService } from '../services/link-export-service.js';
import type { TabExportService } from '../services/tab-export-service.js';
import type { TabsAPI } from '../services/shared-types.js';

export interface RuntimeMessageHandler {
  /**
   * Handle a runtime message
   * @param messageOrTopic - The runtime message or topic
   * @param params - The runtime message params (when calling with topic only)
   * @returns The result text, or null if no result
   */
  handleMessage: (
    messageOrTopic: RuntimeMessage | RuntimeMessage['topic'],
    params?: RuntimeMessage['params'],
  ) => Promise<string | null>;
}

export function createRuntimeMessageHandler(
  services: {
    linkExportService: LinkExportService;
    tabExportService: TabExportService;
  },
  tabsAPI: TabsAPI,
): RuntimeMessageHandler {
  async function handleMessage_(
    messageOrTopic: RuntimeMessage | RuntimeMessage['topic'],
    params?: RuntimeMessage['params'],
  ): Promise<string | null> {
    const message: RuntimeMessage = (typeof messageOrTopic === 'string')
      ? { topic: messageOrTopic, params: params as any } as RuntimeMessage
      : messageOrTopic;

    switch (message.topic) {
      case 'export-current-tab': {
        if (!tabsAPI.get) {
          throw new Error('tabsAPI.get is unavailable');
        }
        const tab = await tabsAPI.get(message.params.tabId);
        if (typeof tab === 'undefined') {
          throw new TypeError('got undefined tab');
        }
        return services.linkExportService.exportLink({
          format: message.params.format,
          customFormatSlot: message.params.customFormatSlot,
          title: tab.title || '',
          url: tab.url || '',
        });
      }

      case 'export-tabs': {
        return services.tabExportService.exportTabs(message.params);
      }

      default: {
        throw new TypeError(`Unknown message topic '${message.topic}'`);
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
