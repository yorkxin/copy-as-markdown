/**
 * Unit tests for context menu handler service
 */

import { describe, expect, it, vi } from 'vitest';
import { createContextMenuHandler } from '../../src/handlers/context-menu-handler.js';
import type { HandlerCore } from '../../src/handlers/handler-core.js';
import type {
  BookmarksAPI,
  BookmarksFormatter,
} from '../../src/handlers/context-menu-handler.js';

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

// Helper to create mock menu click data
function createMockMenuInfo(overrides?: Partial<browser.contextMenus.OnClickData>): browser.contextMenus.OnClickData {
  return {
    menuItemId: 'test-menu',
    editable: false,
    modifiers: [],
    ...overrides,
  } as browser.contextMenus.OnClickData;
}

// Helper to create unused mock stubs
function createUnusedHandlerCore(): HandlerCore {
  return {
    exportSingleLink: vi.fn().mockRejectedValue(new Error('HandlerCoreService.exportSingleLink should not be called in this test')),
    exportMultipleTabs: vi.fn().mockRejectedValue(new Error('HandlerCoreService.exportMultipleTabs should not be called in this test')),
    convertSelection: vi.fn().mockRejectedValue(new Error('HandlerCoreService.convertSelection should not be called in this test')),
    formatImage: vi.fn().mockImplementation(() => {
      throw new Error('HandlerCoreService.formatImage should not be called in this test');
    }),
    formatLinkedImage: vi.fn().mockImplementation(() => {
      throw new Error('HandlerCoreService.formatLinkedImage should not be called in this test');
    }),
  };
}

function createUnusedBookmarksAPI(): BookmarksAPI {
  return {
    getSubTree: vi.fn().mockRejectedValue(new Error('BookmarksAPI should not be called in this test')),
  };
}

function createUnusedBookmarksFormatter(): BookmarksFormatter {
  return {
    toMarkdown: vi.fn().mockImplementation(() => {
      throw new Error('BookmarksFormatter should not be called in this test');
    }),
  };
}

describe('contextMenuHandlerService', () => {
  describe('handleMenuClick - current-tab', () => {
    it('should export current tab as markdown link', async () => {
      // Arrange
      const mockTab = createMockTab({ title: 'Example', url: 'https://example.com' });
      const exportSingleLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        return '[Example](https://example.com)';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('[Example](https://example.com)');
      expect(exportSingleLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should throw error when tab is not provided', async () => {
      // Arrange
      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab' });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/tab is required for current-tab menu item/);
    });
  });

  describe('handleMenuClick - link', () => {
    it('should export regular link as markdown', async () => {
      // Arrange
      const exportSingleLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Click here');
        expect(options.url).toBe('https://example.com');
        return '[Click here](https://example.com)';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'link',
        linkUrl: 'https://example.com',
        selectionText: 'Click here',
      });

      // Act
      const result = await service.handleMenuClick(menuInfo);

      // Assert
      expect(result).toBe('[Click here](https://example.com)');
      expect(exportSingleLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should export linked image as markdown when mediaType is image', async () => {
      // Arrange
      const formatLinkedImageMock = vi.fn((alt: string, imageUrl: string, linkUrl: string) => {
        expect(alt).toBe('');
        expect(imageUrl).toBe('https://example.com/image.png');
        expect(linkUrl).toBe('https://example.com');
        return '[![](https://example.com/image.png)](https://example.com)';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        formatLinkedImage: formatLinkedImageMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'link',
        mediaType: 'image',
        srcUrl: 'https://example.com/image.png',
        linkUrl: 'https://example.com',
      });

      // Act
      const result = await service.handleMenuClick(menuInfo);

      // Assert
      expect(result).toBe('[![](https://example.com/image.png)](https://example.com)');
      expect(formatLinkedImageMock).toHaveBeenCalledTimes(1);
    });

    it('should use linkText when selectionText is not available', async () => {
      // Arrange
      const exportSingleLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('link');
        expect(options.title).toBe('Link Text');
        expect(options.url).toBe('https://example.com');
        return `[Link Text](https://example.com)`;
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'link',
        linkUrl: 'https://example.com',
        linkText: 'Link Text',
      });

      // Act
      await service.handleMenuClick(menuInfo);

      // Assert
      expect(exportSingleLinkMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMenuClick - image', () => {
    it('should export image as markdown', async () => {
      // Arrange
      const formatImageMock = vi.fn((alt: string, url: string) => {
        expect(alt).toBe('');
        expect(url).toBe('https://example.com/image.png');
        return '![](https://example.com/image.png)';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        formatImage: formatImageMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'image',
        srcUrl: 'https://example.com/image.png',
      });

      // Act
      const result = await service.handleMenuClick(menuInfo);

      // Assert
      expect(result).toBe('![](https://example.com/image.png)');
      expect(formatImageMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMenuClick - selection-as-markdown', () => {
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

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'selection-as-markdown' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('converted markdown');
      expect(convertMock).toHaveBeenCalledTimes(1);
    });

    it('should throw error when tab is not provided', async () => {
      // Arrange
      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'selection-as-markdown' });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/tab is required for selection-as-markdown menu item/);
    });
  });

  describe('handleMenuClick - tab list menu items (Firefox)', () => {
    it('should handle all-tabs-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('link');
        expect(options.listType).toBe('list');
        expect(options.windowId).toBe(100);
        return 'all tabs list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('all tabs list');
      expect(exportTabsMock).toHaveBeenCalledTimes(1);
    });

    it('should handle all-tabs-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.listType).toBe('task-list');
        return 'task list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-task-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('task list');
    });

    it('should handle highlighted-tabs-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        return 'highlighted list';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('highlighted list');
    });

    it('should handle highlighted-tabs-task-list', async () => {
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

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-task-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('highlighted task list');
    });

    it('should throw error when tab is not provided for tab list items', async () => {
      // Arrange
      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/tab is required for tab list menu item/);
    });

    it('should throw error when tab has no windowId', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: undefined });

      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act & Assert
      await expect(
        service.handleMenuClick(menuInfo, mockTab),
      ).rejects.toThrow(/tab has no windowId/);
    });
  });

  describe('handleMenuClick - bookmark-link (Firefox)', () => {
    it('should export bookmark as markdown', async () => {
      // Arrange
      const mockBookmark: browser.bookmarks.BookmarkTreeNode = {
        id: 'bookmark-1',
        title: 'Example Bookmark',
        url: 'https://example.com',
      };

      const getSubTreeMock = vi.fn(async (id: string) => {
        expect(id).toBe('bookmark-1');
        return [mockBookmark];
      });

      const toMarkdownMock = vi.fn((bm: browser.bookmarks.BookmarkTreeNode) => {
        expect(bm).toBe(mockBookmark);
        return '[Example Bookmark](https://example.com)';
      });

      const mockBookmarksAPI: BookmarksAPI = {
        getSubTree: getSubTreeMock,
      };

      const mockBookmarksFormatter: BookmarksFormatter = {
        toMarkdown: toMarkdownMock,
      };

      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        mockBookmarksAPI,
        mockBookmarksFormatter,
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'bookmark-link',
        bookmarkId: 'bookmark-1',
      });

      // Act
      const result = await service.handleMenuClick(menuInfo);

      // Assert
      expect(result).toBe('[Example Bookmark](https://example.com)');
      expect(getSubTreeMock).toHaveBeenCalledTimes(1);
      expect(toMarkdownMock).toHaveBeenCalledTimes(1);
    });

    it('should throw error when bookmark is not found', async () => {
      // Arrange
      const mockBookmarksAPI: BookmarksAPI = {
        getSubTree: vi.fn(async () => []),
      };

      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        mockBookmarksAPI,
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'bookmark-link',
        bookmarkId: 'not-found',
      });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/bookmark not found/);
    });

    it('should throw error when bookmarkId is not provided', async () => {
      // Arrange
      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'bookmark-link' });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/bookmarkId is required/);
    });
  });

  describe('handleMenuClick - custom format commands', () => {
    it('should handle current-tab-custom-format-1', async () => {
      // Arrange
      const mockTab = createMockTab({ title: 'Example', url: 'https://example.com' });
      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('1');
        expect(options.title).toBe('Example');
        expect(options.url).toBe('https://example.com');
        return 'custom formatted';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab-custom-format-1' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('custom formatted');
      expect(exportLinkMock).toHaveBeenCalledTimes(1);
    });

    it('should handle link-custom-format-2', async () => {
      // Arrange
      const exportLinkMock = vi.fn(async (options: any) => {
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('2');
        expect(options.title).toBe('Link Text');
        expect(options.url).toBe('https://example.com');
        return 'custom link';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'link-custom-format-2',
        linkUrl: 'https://example.com',
        selectionText: 'Link Text',
      });

      // Act
      const result = await service.handleMenuClick(menuInfo);

      // Assert
      expect(result).toBe('custom link');
    });

    it('should handle all-tabs-custom-format-3', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('all');
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('3');
        return 'custom tabs';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-custom-format-3' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('custom tabs');
    });

    it('should handle highlighted-tabs-custom-format-4', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = vi.fn(async (options: any) => {
        expect(options.scope).toBe('highlighted');
        expect(options.format).toBe('custom-format');
        expect(options.customFormatSlot).toBe('4');
        return 'custom highlighted';
      });

      const mockHandlerCore: HandlerCore = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandler(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-custom-format-4' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      expect(result).toBe('custom highlighted');
    });
  });

  describe('handleMenuClick - error handling', () => {
    it('should throw error for unknown menu item', async () => {
      // Arrange
      const service = createContextMenuHandler(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'unknown-menu-item' });

      // Act & Assert
      await expect(service.handleMenuClick(menuInfo)).rejects.toThrow(/unknown context menu item: unknown-menu-item/);
    });
  });
});
