/**
 * Unit tests for runtime message handler service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createRuntimeMessageHandlerService } from '../../src/services/runtime-message-handler-service.js';
import type { TabsAPI } from '../../src/services/runtime-message-handler-service.js';
import type { BadgeService } from '../../src/services/badge-service.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';

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
function createUnusedBadgeService(): BadgeService {
  return {
    showSuccess: mock.fn(async () => {
      throw new Error('BadgeService.showSuccess should not be called in this test');
    }),
    showError: mock.fn(async () => {
      throw new Error('BadgeService.showError should not be called in this test');
    }),
    clear: mock.fn(async () => {
      throw new Error('BadgeService.clear should not be called in this test');
    }),
    getClearAlarmName: mock.fn(() => {
      throw new Error('BadgeService.getClearAlarmName should not be called in this test');
    }),
  };
}

function createUnusedLinkExportService(): LinkExportService {
  return {
    exportLink: mock.fn(async () => {
      throw new Error('LinkExportService should not be called in this test');
    }),
  };
}

function createUnusedTabExportService(): TabExportService {
  return {
    exportTabs: mock.fn(async () => {
      throw new Error('TabExportService should not be called in this test');
    }),
  };
}

function createUnusedTabsAPI(): TabsAPI {
  return {
    get: mock.fn(async () => {
      throw new Error('TabsAPI should not be called in this test');
    }),
  };
}

describe('RuntimeMessageHandlerService', () => {
  describe('handleMessage - badge topic', () => {
    it('should show success badge when type is success', async () => {
      // Arrange
      const showSuccessMock = mock.fn(async () => {});
      const mockBadgeService: BadgeService = {
        ...createUnusedBadgeService(),
        showSuccess: showSuccessMock,
      };

      const service = createRuntimeMessageHandlerService(
        mockBadgeService,
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedTabsAPI(),
      );

      // Act
      const result = await service.handleMessage('badge', { type: 'success' });

      // Assert
      assert.strictEqual(result, null);
      assert.strictEqual(showSuccessMock.mock.calls.length, 1);
    });

    it('should show error badge when type is not success', async () => {
      // Arrange
      const showErrorMock = mock.fn(async () => {});
      const mockBadgeService: BadgeService = {
        ...createUnusedBadgeService(),
        showError: showErrorMock,
      };

      const service = createRuntimeMessageHandlerService(
        mockBadgeService,
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedTabsAPI(),
      );

      // Act
      const result = await service.handleMessage('badge', { type: 'error' });

      // Assert
      assert.strictEqual(result, null);
      assert.strictEqual(showErrorMock.mock.calls.length, 1);
    });
  });

  describe('handleMessage - export-current-tab topic', () => {
    it('should export current tab with link format', async () => {
      // Arrange
      const mockTab = createMockTab({ id: 42, title: 'Example', url: 'https://example.com' });
      const getMock = mock.fn(async (tabId: number) => {
        assert.strictEqual(tabId, 42);
        return mockTab;
      });

      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        assert.strictEqual(options.customFormatSlot, undefined);
        return '[Example](https://example.com)';
      });

      const mockTabsAPI: TabsAPI = {
        get: getMock,
      };

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        mockLinkExportService,
        createUnusedTabExportService(),
        mockTabsAPI,
      );

      // Act
      const result = await service.handleMessage('export-current-tab', {
        tabId: 42,
        format: 'link',
      });

      // Assert
      assert.strictEqual(result, '[Example](https://example.com)');
      assert.strictEqual(getMock.mock.calls.length, 1);
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });

    it('should export current tab with custom format', async () => {
      // Arrange
      const mockTab = createMockTab({ id: 42, title: 'Example', url: 'https://example.com' });
      const getMock = mock.fn(async () => mockTab);

      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '2');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        return 'custom formatted';
      });

      const mockTabsAPI: TabsAPI = {
        get: getMock,
      };

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        mockLinkExportService,
        createUnusedTabExportService(),
        mockTabsAPI,
      );

      // Act
      const result = await service.handleMessage('export-current-tab', {
        tabId: 42,
        format: 'custom-format',
        customFormatSlot: '2',
      });

      // Assert
      assert.strictEqual(result, 'custom formatted');
    });

    it('should throw error when tab is undefined', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        get: mock.fn(async () => undefined as any),
      };

      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        mockTabsAPI,
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleMessage('export-current-tab', { tabId: 42, format: 'link' }),
        /got undefined tab/,
      );
    });
  });

  describe('handleMessage - export-tabs topic', () => {
    it('should export tabs with provided params', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (params: any) => {
        assert.strictEqual(params.scope, 'all');
        assert.strictEqual(params.format, 'link');
        assert.strictEqual(params.listType, 'list');
        assert.strictEqual(params.windowId, 100);
        return 'exported tabs';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        createUnusedLinkExportService(),
        mockTabExportService,
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
      assert.strictEqual(result, 'exported tabs');
      assert.strictEqual(exportTabsMock.mock.calls.length, 1);
      assert.strictEqual(exportTabsMock.mock.calls[0]!.arguments[0], params);
    });

    it('should export tabs with custom format', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (params: any) => {
        assert.strictEqual(params.scope, 'highlighted');
        assert.strictEqual(params.format, 'custom-format');
        assert.strictEqual(params.customFormatSlot, '1');
        return 'custom tabs';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        createUnusedLinkExportService(),
        mockTabExportService,
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
      assert.strictEqual(result, 'custom tabs');
    });
  });

  describe('handleMessage - error handling', () => {
    it('should throw error for unknown topic', async () => {
      // Arrange
      const service = createRuntimeMessageHandlerService(
        createUnusedBadgeService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedTabsAPI(),
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleMessage('unknown-topic', {}),
        /Unknown message topic 'unknown-topic'/,
      );
    });
  });
});
