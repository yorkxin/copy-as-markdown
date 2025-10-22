/**
 * Unit tests for runtime message handler service
 */

import { describe, expect, it, vi } from 'vitest';
import { createRuntimeMessageHandler } from '../../src/handlers/runtime-message-handler.js';
import type { TabsAPI } from '../../src/handlers/runtime-message-handler.js';
import type { HandlerCore } from '../../src/handlers/handler-core.js';

// Helper to create mock tab
function createMockTab(overrides?: Partial<browser.tabs.Tab>): browser.tabs.Tab {
  return {
    id: 1,
    title: 'Test Tab',
    url: 'https://example.com',
    windowId: 100,
    ...overrides,
  } as browser.tabs.Tab;
}

// Helper to create unused mock stubs
function createUnusedHandlerCore(): HandlerCore {
  return {
    exportSingleLink: vi.fn(async () => {
      throw new Error('HandlerCore.exportSingleLink should not be called in this test');
    }),
    exportMultipleTabs: vi.fn(async () => {
      throw new Error('HandlerCore.exportMultipleTabs should not be called in this test');
    }),
    convertSelection: vi.fn(async () => {
      throw new Error('HandlerCore.convertSelection should not be called in this test');
    }),
    formatImage: vi.fn(() => {
      throw new Error('HandlerCore.formatImage should not be called in this test');
    }),
    formatLinkedImage: vi.fn(() => {
      throw new Error('HandlerCore.formatLinkedImage should not be called in this test');
    }),
  };
}

function createUnusedTabsAPI(): TabsAPI {
  return {
    get: vi.fn(async () => {
      throw new Error('TabsAPI should not be called in this test');
    }),
  };
}

describe('runtimeMessageHandlerService', () => {
  describe('handleMessage - export-current-tab topic', () => {
    it('should export current tab with link format', async () => {
      // Arrange
      const mockTab = createMockTab({ id: 42, title: 'Example', url: 'https://example.com' });
      const getMock = vi.fn(async (tabId: number) => {
        expect(tabId).toBe(42);
        return mockTab;
      });

      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        expect(options.customFormatSlot).toBe(undefined);
        return '[Example](https://example.com)';
      });

      const mockTabsAPI: TabsAPI = {
        get: getMock,
      };

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createRuntimeMessageHandler(
        mockHandlerCore,

        mockTabsAPI,
      );

      // Act
      const result = await service.handleMessage('export-current-tab', {
        tabId: 42,
        format: 'link',
      });

      // Assert
      expect(result, '[Example](https://example.com)');
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should export current tab with custom format', async () => {
      // Arrange
      const mockTab = createMockTab({ id: 42, title: 'Example', url: 'https://example.com' });
      const getMock = vi.fn(async () => mockTab);

      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('2');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        return 'custom formatted';
      });

      const mockTabsAPI: TabsAPI = {
        get: getMock,
      };

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createRuntimeMessageHandler(
        mockHandlerCore,

        mockTabsAPI,
      );

      // Act
      const result = await service.handleMessage('export-current-tab', {
        tabId: 42,
        format: 'custom-format',
        customFormatSlot: '2',
      });

      // Assert
      expect(result).toBe('custom formatted');
    });

    it('should throw error when tab is undefined', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        get: vi.fn(async () => undefined as any),
      };

      const service = createRuntimeMessageHandler(
        createUnusedHandlerCore(),

        mockTabsAPI,
      );

      // Act & Assert
      await expect(
        service.handleMessage('export-current-tab', { tabId: 42, format: 'link' }),
      ).rejects.toThrow(/got undefined tab/);
    });
  });

  describe('handleMessage - export-tabs topic', () => {
    it('should export tabs with provided params', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (params: any) => {
        expect(params.scope).toBe('all');
        expect(params.format).toBe('link');
        expect(params.listType).toBe('list');
        expect(params.windowId).toBe(100);
        return 'exported tabs';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createRuntimeMessageHandler(
        mockHandlerCore,
        createUnusedTabsAPI(),
      );

      const params = {
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 100,
      };

      // Act
      const result = await service.handleMessage('export-tabs', params);

      // Assert
      expect(result).toBe('exported tabs');
      expect(exportTabsMock).toHaveBeenCalledTimes(1);
      expect(exportTabsMock).toHaveBeenCalledWith(params);
    });

    it('should export tabs with custom format', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (params: any) => {
        expect(params.scope).toBe('highlighted');
        expect(params.format).toBe('custom-format');
        expect(params.customFormatSlot).toBe('1');
        return 'custom tabs';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createRuntimeMessageHandler(
        mockHandlerCore,
        createUnusedTabsAPI(),
      );

      // Act
      const result = await service.handleMessage('export-tabs', {
        scope: 'highlighted',
        format: 'custom-format',
        customFormatSlot: '1',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('custom tabs');
    });
  });

  describe('handleMessage - error handling', () => {
    it('should throw error for unknown topic', async () => {
      // Arrange
      const service = createRuntimeMessageHandler(
        createUnusedHandlerCore(),
        createUnusedTabsAPI(),
      );

      // Act & Assert
      await expect(
        service.handleMessage('unknown-topic', {}),
      ).rejects.toThrow(/Unknown message topic 'unknown-topic'/);
    });
  });
});
