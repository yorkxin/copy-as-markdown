/**
 * Unit tests for handler core service
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandlerCore } from '../../src/handlers/handler-core.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';
import type { SelectionConverterService } from '../../src/services/selection-converter-service.js';

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
    exportLink: vi.fn().mockRejectedValue(new Error('LinkExportService should not be called in this test')),
  };
}

function createUnusedTabExportService(): TabExportService {
  return {
    exportTabs: vi.fn().mockRejectedValue(new Error('TabExportService should not be called in this test')),
  };
}

function createUnusedSelectionConverterService(): SelectionConverterService {
  return {
    convertSelectionToMarkdown: vi.fn().mockRejectedValue(new Error('SelectionConverterService should not be called in this test')),
  };
}

describe('handlerCoreService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportSingleLink', () => {
    it('should export link in standard format', async () => {
      // Arrange
      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        expect(options.customFormatSlot).toBe(undefined);
        return '[Example](https://example.com)';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createHandlerCore(
        mockLinkExportService,
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportSingleLink({
        format: 'link',
        title: 'Example',
        url: 'https://example.com',
      });

      // Assert
      expect(result, '[Example](https://example.com)');
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should export link in custom format', async () => {
      // Arrange
      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('2');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        return 'custom formatted link';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createHandlerCore(
        mockLinkExportService,
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportSingleLink({
        format: 'custom-format',
        customFormatSlot: '2',
        title: 'Example',
        url: 'https://example.com',
      });

      // Assert
      expect(result).toBe('custom formatted link');
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportMultipleTabs', () => {
    it('should export all tabs as link list', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('list');
        expect(options.windowId).toBe(100);
        return 'all tabs as list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('all tabs as list');
      expect(exportTabsMock).toHaveBeenCalledTimes(1);
    });

    it('should export highlighted tabs as task list', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('task-list');
        return 'highlighted tabs as task list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'task-list',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('highlighted tabs as task list');
    });

    it('should export tabs as title list', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('title');
        return 'titles list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('titles list');
    });

    it('should export tabs as url list', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('url');
        return 'urls list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'all',
        format: 'url',
        listType: 'list',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('urls list');
    });

    it('should export tabs with custom format', async () => {
      // Arrange
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('3');
        return 'custom formatted tabs';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        mockTabExportService,
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = await service.exportMultipleTabs({
        scope: 'highlighted',
        format: 'custom-format',
        customFormatSlot: '3',
        windowId: 100,
      });

      // Assert
      expect(result).toBe('custom formatted tabs');
    });
  });

  describe('convertSelection', () => {
    it('should convert selection to markdown', async () => {
      // Arrange
      const mockTab = createMockTab();
      const convertMock = vi.fn(async (tab: browser.tabs.Tab) => {
        expect(tab).toBe(mockTab);
        return 'converted markdown';
      });

      const mockSelectionConverterService: SelectionConverterService = {
        convertSelectionToMarkdown: convertMock,
      };

      const service = createHandlerCore(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        mockSelectionConverterService,
      );

      // Act
      const result = await service.convertSelection(mockTab);

      // Assert
      expect(result).toBe('converted markdown');
      expect(convertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatImage', () => {
    it('should format image as markdown', () => {
      // Arrange
      const service = createHandlerCore(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = service.formatImage('Alt text', 'https://example.com/image.png');

      // Assert
      expect(result, '![Alt text](https://example.com/image.png)');
    });

    it('should handle empty alt text', () => {
      // Arrange
      const service = createHandlerCore(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = service.formatImage('', 'https://example.com/image.png');

      // Assert
      expect(result, '![](https://example.com/image.png)');
    });
  });

  describe('formatLinkedImage', () => {
    it('should format linked image as markdown', () => {
      // Arrange
      const service = createHandlerCore(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = service.formatLinkedImage('Alt text', 'https://example.com/image.png', 'https://example.com');

      // Assert
      expect(result, '[![Alt text](https://example.com/image.png)](https://example.com)');
    });

    it('should handle empty alt text', () => {
      // Arrange
      const service = createHandlerCore(
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
        createUnusedSelectionConverterService(),
      );

      // Act
      const result = service.formatLinkedImage('', 'https://example.com/image.png', 'https://example.com');

      // Assert
      expect(result, '[![](https://example.com/image.png)](https://example.com)');
    });
  });
});
