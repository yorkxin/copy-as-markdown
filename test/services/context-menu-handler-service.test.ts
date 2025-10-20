/**
 * Unit tests for context menu handler service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createContextMenuHandlerService } from '../../src/services/context-menu-handler-service.js';
import type { HandlerCoreService } from '../../src/services/handler-core-service.js';
import type {
  BookmarksAPI,
  BookmarksFormatter,
} from '../../src/services/context-menu-handler-service.js';

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
function createUnusedHandlerCore(): HandlerCoreService {
  return {
    exportSingleLink: mock.fn(async () => {
      throw new Error('HandlerCoreService.exportSingleLink should not be called in this test');
    }),
    exportMultipleTabs: mock.fn(async () => {
      throw new Error('HandlerCoreService.exportMultipleTabs should not be called in this test');
    }),
    convertSelection: mock.fn(async () => {
      throw new Error('HandlerCoreService.convertSelection should not be called in this test');
    }),
    formatImage: mock.fn(() => {
      throw new Error('HandlerCoreService.formatImage should not be called in this test');
    }),
    formatLinkedImage: mock.fn(() => {
      throw new Error('HandlerCoreService.formatLinkedImage should not be called in this test');
    }),
  };
}

function createUnusedBookmarksAPI(): BookmarksAPI {
  return {
    getSubTree: mock.fn(async () => {
      throw new Error('BookmarksAPI should not be called in this test');
    }),
  };
}

function createUnusedBookmarksFormatter(): BookmarksFormatter {
  return {
    toMarkdown: mock.fn(() => {
      throw new Error('BookmarksFormatter should not be called in this test');
    }),
  };
}

describe('ContextMenuHandlerService', () => {
  describe('handleMenuClick - current-tab', () => {
    it('should export current tab as markdown link', async () => {
      // Arrange
      const mockTab = createMockTab({ title: 'Example', url: 'https://example.com' });
      const exportSingleLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        return '[Example](https://example.com)';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, '[Example](https://example.com)');
      assert.strictEqual(exportSingleLinkMock.mock.calls.length, 1);
    });

    it('should throw error when tab is not provided', async () => {
      // Arrange
      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /tab is required for current-tab menu item/,
      );
    });
  });

  describe('handleMenuClick - link', () => {
    it('should export regular link as markdown', async () => {
      // Arrange
      const exportSingleLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Click here');
        assert.strictEqual(options.url, 'https://example.com');
        return '[Click here](https://example.com)';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(result, '[Click here](https://example.com)');
      assert.strictEqual(exportSingleLinkMock.mock.calls.length, 1);
    });

    it('should export linked image as markdown when mediaType is image', async () => {
      // Arrange
      const formatLinkedImageMock = mock.fn((alt: string, imageUrl: string, linkUrl: string) => {
        assert.strictEqual(alt, '');
        assert.strictEqual(imageUrl, 'https://example.com/image.png');
        assert.strictEqual(linkUrl, 'https://example.com');
        return '[![](https://example.com/image.png)](https://example.com)';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        formatLinkedImage: formatLinkedImageMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(result, '[![](https://example.com/image.png)](https://example.com)');
      assert.strictEqual(formatLinkedImageMock.mock.calls.length, 1);
    });

    it('should use linkText when selectionText is not available', async () => {
      // Arrange
      const exportSingleLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.title, 'Link Text');
        assert.strictEqual(options.url, 'https://example.com');
        return `[Link Text](https://example.com)`;
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportSingleLinkMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(exportSingleLinkMock.mock.calls.length, 1);
    });
  });

  describe('handleMenuClick - image', () => {
    it('should export image as markdown', async () => {
      // Arrange
      const formatImageMock = mock.fn((alt: string, url: string) => {
        assert.strictEqual(alt, '');
        assert.strictEqual(url, 'https://example.com/image.png');
        return '![](https://example.com/image.png)';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        formatImage: formatImageMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(result, '![](https://example.com/image.png)');
      assert.strictEqual(formatImageMock.mock.calls.length, 1);
    });
  });

  describe('handleMenuClick - selection-as-markdown', () => {
    it('should convert selection to markdown', async () => {
      // Arrange
      const mockTab = createMockTab();
      const convertMock = mock.fn(async (tab: browser.tabs.Tab) => {
        assert.strictEqual(tab, mockTab);
        return 'converted markdown';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        convertSelection: convertMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'selection-as-markdown' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'converted markdown');
      assert.strictEqual(convertMock.mock.calls.length, 1);
    });

    it('should throw error when tab is not provided', async () => {
      // Arrange
      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'selection-as-markdown' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /tab is required for selection-as-markdown menu item/,
      );
    });
  });

  describe('handleMenuClick - tab list menu items (Firefox)', () => {
    it('should handle all-tabs-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'link');
        assert.strictEqual(options.listType, 'list');
        assert.strictEqual(options.windowId, 100);
        return 'all tabs list';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'all tabs list');
      assert.strictEqual(exportTabsMock.mock.calls.length, 1);
    });

    it('should handle all-tabs-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.listType, 'task-list');
        return 'task list';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-task-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'task list');
    });

    it('should handle highlighted-tabs-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        return 'highlighted list';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted list');
    });

    it('should handle highlighted-tabs-task-list', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.listType, 'task-list');
        return 'highlighted task list';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-task-list' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'highlighted task list');
    });

    it('should throw error when tab is not provided for tab list items', async () => {
      // Arrange
      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /tab is required for tab list menu item/,
      );
    });

    it('should throw error when tab has no windowId', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: undefined });

      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-list' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo, mockTab),
        /tab has no windowId/,
      );
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

      const getSubTreeMock = mock.fn(async (id: string) => {
        assert.strictEqual(id, 'bookmark-1');
        return [mockBookmark];
      });

      const toMarkdownMock = mock.fn((bm: browser.bookmarks.BookmarkTreeNode) => {
        assert.strictEqual(bm, mockBookmark);
        return '[Example Bookmark](https://example.com)';
      });

      const mockBookmarksAPI: BookmarksAPI = {
        getSubTree: getSubTreeMock,
      };

      const mockBookmarksFormatter: BookmarksFormatter = {
        toMarkdown: toMarkdownMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(result, '[Example Bookmark](https://example.com)');
      assert.strictEqual(getSubTreeMock.mock.calls.length, 1);
      assert.strictEqual(toMarkdownMock.mock.calls.length, 1);
    });

    it('should throw error when bookmark is not found', async () => {
      // Arrange
      const mockBookmarksAPI: BookmarksAPI = {
        getSubTree: mock.fn(async () => []),
      };

      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        mockBookmarksAPI,
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({
        menuItemId: 'bookmark-link',
        bookmarkId: 'not-found',
      });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /bookmark not found/,
      );
    });

    it('should throw error when bookmarkId is not provided', async () => {
      // Arrange
      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'bookmark-link' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /bookmarkId is required/,
      );
    });
  });

  describe('handleMenuClick - custom format commands', () => {
    it('should handle current-tab-custom-format-1', async () => {
      // Arrange
      const mockTab = createMockTab({ title: 'Example', url: 'https://example.com' });
      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '1');
        assert.strictEqual(options.title, 'Example');
        assert.strictEqual(options.url, 'https://example.com');
        return 'custom formatted';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'current-tab-custom-format-1' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'custom formatted');
      assert.strictEqual(exportLinkMock.mock.calls.length, 1);
    });

    it('should handle link-custom-format-2', async () => {
      // Arrange
      const exportLinkMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '2');
        assert.strictEqual(options.title, 'Link Text');
        assert.strictEqual(options.url, 'https://example.com');
        return 'custom link';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportSingleLink: exportLinkMock,
      };

      const service = createContextMenuHandlerService(
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
      assert.strictEqual(result, 'custom link');
    });

    it('should handle all-tabs-custom-format-3', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'all');
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '3');
        return 'custom tabs';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'all-tabs-custom-format-3' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'custom tabs');
    });

    it('should handle highlighted-tabs-custom-format-4', async () => {
      // Arrange
      const mockTab = createMockTab({ windowId: 100 });
      const exportTabsMock = mock.fn(async (options: any) => {
        assert.strictEqual(options.scope, 'highlighted');
        assert.strictEqual(options.format, 'custom-format');
        assert.strictEqual(options.customFormatSlot, '4');
        return 'custom highlighted';
      });

      const mockHandlerCore: HandlerCoreService = {
        ...createUnusedHandlerCore(),
        exportMultipleTabs: exportTabsMock,
      };

      const service = createContextMenuHandlerService(
        mockHandlerCore,
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'highlighted-tabs-custom-format-4' });

      // Act
      const result = await service.handleMenuClick(menuInfo, mockTab);

      // Assert
      assert.strictEqual(result, 'custom highlighted');
    });
  });

  describe('handleMenuClick - error handling', () => {
    it('should throw error for unknown menu item', async () => {
      // Arrange
      const service = createContextMenuHandlerService(
        createUnusedHandlerCore(),
        createUnusedBookmarksAPI(),
        createUnusedBookmarksFormatter(),
      );

      const menuInfo = createMockMenuInfo({ menuItemId: 'unknown-menu-item' });

      // Act & Assert
      await assert.rejects(
        () => service.handleMenuClick(menuInfo),
        /unknown context menu item: unknown-menu-item/,
      );
    });
  });
});
