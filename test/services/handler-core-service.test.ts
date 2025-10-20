/**
 * Unit tests for handler core service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createHandlerCoreService } from '../../src/services/handler-core-service.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';
import type { SelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { BadgeService } from '../../src/services/badge-service.js';

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

function createUnusedSelectionConverterService(): SelectionConverterService {
  return {
    convertSelectionToMarkdown: mock.fn(async () => {
      throw new Error('SelectionConverterService should not be called in this test');
    }),
  };
}

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

describe('HandlerCoreService', () => {
  describe('exportSingleLink', () => {
    it('should export link in standard format', async () => {
      // Arrange
      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        assert.strictEqual(options.customFormatSlot, undefined);
        return '[Example](https://example.com)';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createHandlerCoreService(
        mockLinkExportService,
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportSingleLink({
        format: 'link',
        title: 'Example',
        url: 'https://example.com',
      });

      // Assert
      assert.strictEqual(result, '[Example](https://example.com)');
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });

    it('should export link in custom format', async () => {
      // Arrange
      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '2');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        return 'custom formatted link';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createHandlerCoreService(
        mockLinkExportService,
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportSingleLink({
        format: 'custom-format',
        customFormatSlot: '2',
        title: 'Example',
        url: 'https://example.com',
      });

      // Assert
      assert.strictEqual(result, 'custom formatted link');
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });
  });

  describe('exportMultipleTabs', () => {
    it('should export all tabs as link list', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'list');
        assert.strictEqual(options.windowId, 100);
        return 'all tabs as list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      assert.strictEqual(result, 'all tabs as list');
      assert.strictEqual(exportTabsMock.mock.calls.length, 1);
    });

    it('should export highlighted tabs as task list', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'task-list');
        return 'highlighted tabs as task list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'task-list',
        windowId: 100,
      });

      // Assert
      assert.strictEqual(result, 'highlighted tabs as task list');
    });

    it('should export tabs as title list', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'title');
        return 'titles list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      assert.strictEqual(result, 'titles list');
    });

    it('should export tabs as url list', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'url');
        return 'urls list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'url',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      assert.strictEqual(result, 'urls list');
    });

    it('should export tabs with custom format', async () => {
      // Arrange
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '3');
        return 'custom formatted tabs';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'highlighted',
        format: 'custom-format',
        customFormatSlot: '3',
        windowId: 100,
      });

      // Assert
      assert.strictEqual(result, 'custom formatted tabs');
    });
  });

  describe('convertSelection', () => {
    it('should convert selection to markdown', async () => {
      // Arrange
      const mockTab = createMockTab();
      const convertMock = mock.fn(async (tab: browser.tabs.Tab) => {
        assert.strictEqual(tab, mockTab);
        return 'converted markdown';
      });

      const mockSelectionConverterService: SelectionConverterService = {
        convertSelectionToMarkdown: convertMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        mockSelectionConverterService,
        createUnusedBadgeService(),
      );

      // Act
      const result = await service.convertSelection(mockTab);

      // Assert
      assert.strictEqual(result, 'converted markdown');
      assert.strictEqual(convertMock.mock.calls.length, 1);
    });
  });

  describe('showSuccessBadge', () => {
    it('should call badgeService.showSuccess', async () => {
      // Arrange
      const showSuccessMock = mock.fn(async () => {});

      const mockBadgeService: BadgeService = {
        ...createUnusedBadgeService(),
        showSuccess: showSuccessMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        mockBadgeService,
      );

      // Act
      await service.showSuccessBadge();

      // Assert
      assert.strictEqual(showSuccessMock.mock.calls.length, 1);
    });
  });

  describe('showErrorBadge', () => {
    it('should call badgeService.showError', async () => {
      // Arrange
      const showErrorMock = mock.fn(async () => {});

      const mockBadgeService: BadgeService = {
        ...createUnusedBadgeService(),
        showError: showErrorMock,
      };

      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        mockBadgeService,
      );

      // Act
      await service.showErrorBadge();

      // Assert
      assert.strictEqual(showErrorMock.mock.calls.length, 1);
    });
  });

  describe('formatImage', () => {
    it('should format image as markdown', () => {
      // Arrange
      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = service.formatImage('Alt text', 'https://example.com/image.png');

      // Assert
      assert.strictEqual(result, '![Alt text](https://example.com/image.png)');
    });

    it('should handle empty alt text', () => {
      // Arrange
      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = service.formatImage('', 'https://example.com/image.png');

      // Assert
      assert.strictEqual(result, '![](https://example.com/image.png)');
    });
  });

  describe('formatLinkedImage', () => {
    it('should format linked image as markdown', () => {
      // Arrange
      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = service.formatLinkedImage('Alt text', 'https://example.com/image.png', 'https://example.com');

      // Assert
      assert.strictEqual(result, '[![Alt text](https://example.com/image.png)](https://example.com)');
    });

    it('should handle empty alt text', () => {
      // Arrange
      const service = createHandlerCoreService(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
        createUnusedBadgeService(),
      );

      // Act
      const result = service.formatLinkedImage('', 'https://example.com/image.png', 'https://example.com');

      // Assert
      assert.strictEqual(result, '[![](https://example.com/image.png)](https://example.com)');
    });
  });
});
