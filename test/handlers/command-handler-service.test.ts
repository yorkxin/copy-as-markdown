/**
 * Unit tests for command handler service
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeyboardCommandHandler } from '../../src/handlers/keyboard-command-handler.js';

import type {
  TabsAPI,
} from '../../src/handlers/keyboard-command-handler.js';
import type { HandlerCore } from '../../src/handlers/handler-core.js';

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

// Helper to create unused mock stubs
function createUnusedTabsAPI(): TabsAPI {
  return {
    query: vi.fn(async () => {
      throw new Error('TabsAPI.query should not be called in this test');
    }),
  };
}

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
    showSuccessBadge: vi.fn(async () => {
      throw new Error('HandlerCore.showSuccessBadge should not be called in this test');
    }),
    showErrorBadge: vi.fn(async () => {
      throw new Error('HandlerCore.showErrorBadge should not be called in this test');
    }),
  };
}

describe('commandHandlerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleCommand - tab resolution', () => {
    it('should use provided tab when available', async () => {
      // Arrange
      const queryMock = vi.fn(async () => {
        throw new Error('TabsAPI.query should not be called when tab is provided');
      });

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const convertMock = vi.fn(async () => 'markdown content');
      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        convertSelection: convertMock,
      };

      const service = createKeyboardCommandHandler(
        mockTabsAPI,
        mockHandlerCore,
      );

      const mockTab = createMockTab();

      // Act
      await service.handleCommand('selection-as-markdown', mockTab);

      // Assert
      expect(queryMock).toHaveBeenCalledTimes(0);
      expect(convertMock).toHaveBeenCalledTimes(1);
      expect(convertMock).toHaveBeenCalledWith(mockTab);
    });

    it('should query for current tab when not provided', async () => {
      // Arrange
      const mockTab = createMockTab();
      const queryMock = vi.fn(async () => [mockTab]);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const convertMock = vi.fn(async () => 'markdown content');
      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        convertSelection: convertMock,
      };

      const service = createKeyboardCommandHandler(
        mockTabsAPI,
        mockHandlerCore,
      );

      // Act
      await service.handleCommand('selection-as-markdown');

      // Assert
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).toHaveBeenCalledWith({
        currentWindow: true,
        active: true,
      });
      expect(convertMock).toHaveBeenCalledTimes(1);
      expect(convertMock).toHaveBeenCalledWith(mockTab);
    });

    it('should throw error if no current tab found', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => []),
      };

      const service = createKeyboardCommandHandler(
        mockTabsAPI,
        createUnusedHandlerCore(),
      );

      // Act & Assert
      await expect(service.handleCommand('selection-as-markdown')).rejects.toThrow(/failed to get current tab/);
    });

    it('should throw error if tab has no windowId', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: undefined });

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        createUnusedHandlerCore(),
      );

      // Act & Assert
      await expect(
        service.handleCommand('all-tabs-link-as-list', mockTab),
      ).rejects.toThrow(/tab has no windowId/);
    });
  });

  describe('handleCommand - selection-as-markdown', () => {
    it('should convert selection to markdown', async () => {
      // Arrange
      const mockTab = createMockTab();
      const convertMock = vi.fn(async (tab: browser.tabs.Tab) => {
        expect(tab).toBe(mockTab);
        return 'converted markdown';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        convertSelection: convertMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('selection-as-markdown', mockTab);

      // Assert
      expect(result).toBe('converted markdown');
      expect(convertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCommand - current-tab-link', () => {
    it('should export current tab as link', async () => {
      // Arrange
      const mockTab = createMockTab({
        title: 'Example Site',
        url: 'https://example.com',
      });

      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Example Site');
        expect(options.url).toBe('https://example.com');
        return '[Example Site](https://example.com)';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('current-tab-link', mockTab);

      // Assert
      expect(result, '[Example Site](https://example.com)');
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCommand - all-tabs commands', () => {
    it('should handle all-tabs-link-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('list');
        expect(options.windowId).toBe(100);
        return 'tabs as list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('all-tabs-link-as-list', mockTab);

      // Assert
      expect(result).toBe('tabs as list');
      expect(exportTabsMock).toHaveBeenCalledTimes(1);
    });

    it('should handle all-tabs-link-as-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('task-list');
        return 'tabs as task list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('all-tabs-link-as-task-list', mockTab);

      // Assert
      expect(result).toBe('tabs as task list');
    });

    it('should handle all-tabs-title-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('title');
        expect(options.listType).toBe('list');
        return 'titles list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('all-tabs-title-as-list', mockTab);

      // Assert
      expect(result).toBe('titles list');
    });

    it('should handle all-tabs-url-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('url');
        return 'urls list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('all-tabs-url-as-list', mockTab);

      // Assert
      expect(result).toBe('urls list');
    });
  });

  describe('handleCommand - highlighted-tabs commands', () => {
    it('should handle highlighted-tabs-link-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('list');
        return 'highlighted tabs list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-link-as-list', mockTab);

      // Assert
      expect(result).toBe('highlighted tabs list');
    });

    it('should handle highlighted-tabs-link-as-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.listType).toBe('task-list');
        return 'highlighted task list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-link-as-task-list', mockTab);

      // Assert
      expect(result).toBe('highlighted task list');
    });

    it('should handle highlighted-tabs-title-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('title');
        return 'highlighted titles';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-title-as-list', mockTab);

      // Assert
      expect(result).toBe('highlighted titles');
    });

    it('should handle highlighted-tabs-url-as-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('url');
        return 'highlighted urls';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-url-as-list', mockTab);

      // Assert
      expect(result).toBe('highlighted urls');
    });
  });

  describe('handleCommand - custom format commands', () => {
    it('should handle current-tab-custom-format-1', async () => {
      // Arrange
      const mockTab = createMockTab({
        title: 'Example',
        url: 'https://example.com',
      });

      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('1');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        return 'custom formatted link';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('current-tab-custom-format-1', mockTab);

      // Assert
      expect(result).toBe('custom formatted link');
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should handle all-tabs-custom-format-2', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('2');
        expect(options.windowId).toBe(100);
        return 'custom tabs format';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('all-tabs-custom-format-2', mockTab);

      // Assert
      expect(result).toBe('custom tabs format');
    });

    it('should handle highlighted-tabs-custom-format-3', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('3');
        return 'custom highlighted format';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        mockHandlerCore,
      );

      // Act
      const result = await service.handleCommand('highlighted-tabs-custom-format-3', mockTab);

      // Assert
      expect(result).toBe('custom highlighted format');
    });
  });

  describe('handleCommand - error handling', () => {
    it('should throw error for unknown command', async () => {
      // Arrange
      const mockTab = createMockTab();

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        createUnusedHandlerCore(),
      );

      // Act & Assert
      await expect(
        service.handleCommand('unknown-command', mockTab),
      ).rejects.toThrow(/unknown keyboard command: unknown-command/);
    });

    it('should throw error for malformed custom format command', async () => {
      // Arrange
      const mockTab = createMockTab();

      const service = createKeyboardCommandHandler(
        createUnusedTabsAPI(),
        createUnusedHandlerCore(),
      );

      // Act & Assert
      await expect(
        service.handleCommand('invalid-custom-format-command', mockTab),
      ).rejects.toThrow(/unknown keyboard command/);
    });
  });
});
