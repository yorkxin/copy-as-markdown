/**
 * Unit tests for command handler service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createCommandHandlerService } from '../../src/services/command-handler-service.js';
import type {
  TabsAPI,
} from '../../src/services/command-handler-service.js';
import type { SelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';

// Helper to create a mock tab
function createMockTab(overrides?: Partial<browser.tabs.Tab>): browser.tabs.Tab {
  return {
    id: 1,
    title: 'Test Tab',
    url: 'https://example.com',
    windowId: 100,
    ...overrides,
  } as browser.tabs.Tab;
}

// Helper to create unused mock stubs (for dependencies not used in specific tests)
function createUnusedTabsAPI(): TabsAPI {
  return {
    query: mock.fn(async () => {
      throw new Error('TabsAPI.query should not be called in this test');
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

describe('CommandHandlerService', () => {
  describe('handleCommand - tab resolution', () => {
    it('should use provided tab when available', async () => {
      // Arrange
      const queryMock = mock.fn(async () => {
        throw new Error('TabsAPI.query should not be called when tab is provided');
      });

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const convertMock = mock.fn(async () => 'markdown content');
      const mockSelectionConverterService: SelectionConverterService = {
        convertSelectionToMarkdown: convertMock,
      };

      const service = createCommandHandlerService(
        mockTabsAPI,
        mockSelectionConverterService,
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      const mockTab = createMockTab();

      // Act
      await service.handleCommand('selection-as-markdown', mockTab);

      // Assert
      assert.strictEqual(queryMock.mock.calls.length, 0);
      assert.strictEqual(convertMock.mock.calls.length, 1);
      assert.strictEqual(convertMock.mock.calls[0]!.arguments[0], mockTab);
    });

    it('should query for current tab when not provided', async () => {
      // Arrange
      const mockTab = createMockTab();
      const queryMock = mock.fn(async () => [mockTab]);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const convertMock = mock.fn(async () => 'markdown content');
      const mockSelectionConverterService: SelectionConverterService = {
        convertSelectionToMarkdown: convertMock,
      };

      const service = createCommandHandlerService(
        mockTabsAPI,
        mockSelectionConverterService,
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act
      await service.handleCommand('selection-as-markdown');

      // Assert
      assert.strictEqual(queryMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryMock.mock.calls[0]!.arguments[0], {
        currentWindow: true,
        active: true,
      });
      assert.strictEqual(convertMock.mock.calls.length, 1);
      assert.strictEqual(convertMock.mock.calls[0]!.arguments[0], mockTab);
    });

    it('should throw error if no current tab found', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => []),
      };

      const service = createCommandHandlerService(
        mockTabsAPI,
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleCommand('selection-as-markdown'),
        /failed to get current tab/,
      );
    });

    it('should throw error if tab has no windowId', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: undefined });

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleCommand('all-tabs-link-as-list', mockTab),
        /tab has no windowId/,
      );
    });
  });

  describe('handleCommand - selection-as-markdown', () => {
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

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        mockSelectionConverterService,
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act
      const result = await service.handleCommand('selection-as-markdown', mockTab);

      // Assert
      assert.strictEqual(result, 'converted markdown');
      assert.strictEqual(convertMock.mock.calls.length, 1);
    });
  });

  describe('handleCommand - current-tab-link', () => {
    it('should export current tab as link', async () => {
      // Arrange
      const mockTab = createMockTab({
        title: 'Example Site',
        url: 'https://example.com',
      });

      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Example Site');
        assert.strictEqual(options.url, 'https://example.com');
        return '[Example Site](https://example.com)';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        mockLinkExportService,
        createUnusedTabExportService(),
      );

      // Act
      const result = await service.handleCommand('current-tab-link', mockTab);

      // Assert
      assert.strictEqual(result, '[Example Site](https://example.com)');
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });
  });

  describe('handleCommand - all-tabs commands', () => {
    it('should handle all-tabs-link-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'list');
        assert.strictEqual(options.windowId, 100);
        return 'tabs as list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('all-tabs-link-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'tabs as list');
      assert.strictEqual(exportTabsMock.mock.calls.length, 1);
    });

    it('should handle all-tabs-link-as-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'task-list');
        return 'tabs as task list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('all-tabs-link-as-task-list', mockTab);

      // Assert
      assert.strictEqual(result, 'tabs as task list');
    });

    it('should handle all-tabs-title-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'title');
        assert.strictEqual(options.listType, 'list');
        return 'titles list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('all-tabs-title-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'titles list');
    });

    it('should handle all-tabs-url-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'url');
        return 'urls list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('all-tabs-url-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'urls list');
    });
  });

  describe('handleCommand - highlighted-tabs commands', () => {
    it('should handle highlighted-tabs-link-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'list');
        return 'highlighted tabs list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-link-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted tabs list');
    });

    it('should handle highlighted-tabs-link-as-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.listType, 'task-list');
        return 'highlighted task list';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-link-as-task-list', mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted task list');
    });

    it('should handle highlighted-tabs-title-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'title');
        return 'highlighted titles';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-title-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted titles');
    });

    it('should handle highlighted-tabs-url-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'url');
        return 'highlighted urls';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-url-as-list', mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted urls');
    });
  });

  describe('handleCommand - custom format commands', () => {
    it('should handle current-tab-custom-format-1', async () => {
      // Arrange
      const mockTab = createMockTab({
        title: 'Example',
        url: 'https://example.com',
      });

      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '1');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        return 'custom formatted link';
      });

      const mockLinkExportService: LinkExportService = {
        exportLink: exportLinkMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        mockLinkExportService,
        createUnusedTabExportService(),
      );

      // Act
      const result = await service.handleCommand('current-tab-custom-format-1', mockTab);

      // Assert
      assert.strictEqual(result, 'custom formatted link');
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });

    it('should handle all-tabs-custom-format-2', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '2');
        assert.strictEqual(options.windowId, 100);
        return 'custom tabs format';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('all-tabs-custom-format-2', mockTab);

      // Assert
      assert.strictEqual(result, 'custom tabs format');
    });

    it('should handle highlighted-tabs-custom-format-3', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '3');
        return 'custom highlighted format';
      });

      const mockTabExportService: TabExportService = {
        exportTabs: exportTabsMock,
      };

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        mockTabExportService,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-custom-format-3', mockTab);

      // Assert
      assert.strictEqual(result, 'custom highlighted format');
    });
  });

  describe('handleCommand - error handling', () => {
    it('should throw error for unknown command', async () => {
      // Arrange
      const mockTab = createMockTab();

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleCommand('unknown-command', mockTab),
        /unknown keyboard command: unknown-command/,
      );
    });

    it('should throw error for malformed custom format command', async () => {
      // Arrange
      const mockTab = createMockTab();

      const service = createCommandHandlerService(
        createUnusedTabsAPI(),
        createUnusedSelectionConverterService(),
        createUnusedLinkExportService(),
        createUnusedTabExportService(),
      );

      // Act & Assert
      await assert.rejects(
        () => service.handleCommand('invalid-custom-format-command', mockTab),
        /unknown keyboard command/,
      );
    });
  });
});
