/**
 * Service for handling runtime messages from popup and other extension pages
 */

import type { HandlerCoreService } from './handler-core-service.js';

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
  handlerCore: HandlerCoreService,
  tabsAPI: TabsAPI,
): RuntimeMessageHandlerService {
  async function handleMessage_(topic: string, params: any): Promise<string | null> {
    switch (topic) {
      case 'export-current-tab': {
        const tab = await tabsAPI.get(params.tabId);
        if (typeof tab === 'undefined') {
          throw new TypeError('got undefined tab');
        }
        return handlerCore.exportSingleLink({
          format: params.format,
          customFormatSlot: params.customFormatSlot,
          title: tab.title || '',
          url: tab.url || '',
        });
      }

      case 'export-tabs': {
        return handlerCore.exportMultipleTabs(params);
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
  handlerCore: HandlerCoreService,
): RuntimeMessageHandlerService {
  return createRuntimeMessageHandlerService(
    handlerCore,
    browser.tabs,
  );
}
