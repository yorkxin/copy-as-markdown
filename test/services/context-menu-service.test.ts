/**
 * Unit tests for context menu service
 */

import { describe, expect, it, vi } from 'vitest';
import { createContextMenuService } from '../../src/services/context-menu-service.js';
import type {
  ContextMenusAPI,
  CustomFormatsProvider,
} from '../../src/services/context-menu-service.js';

// Mock CustomFormat interface (matches what the service expects)
interface MockCustomFormat {
  slot: string;
  displayName: string;
  showInMenus: boolean;
}

// Helper to create mock custom formats
function createMockCustomFormat(
  slot: string,
  name: string,
  showInMenus: boolean = true,
): MockCustomFormat {
  return {
    slot,
    displayName: name || `Custom Format ${slot}`,
    showInMenus,
  };
}

describe('contextMenuService', () => {
  describe('createAll', () => {
    it('should remove all existing menus first', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      expect(removeAllMock).toHaveBeenCalledTimes(1);
    });

    it('should create basic menus (current-tab and link)', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Find current-tab menu
      const currentTabCall = createCalls.find(
        (call: any) => call[0]?.id === 'current-tab',
      );
      expect(currentTabCall, 'current-tab menu should be created').toBeDefined();
      expect(currentTabCall[0]?.title).toBe('Copy Page Link as Markdown');
      expect(currentTabCall[0]?.contexts).toEqual(['page']);

      // Find link menu
      const linkCall = createCalls.find(
        (call: any) => call[0]?.id === 'link',
      );
      expect(linkCall, 'link menu should be created').toBeDefined();
      expect(linkCall[0]?.title).toBe('Copy Link as Markdown');
      expect(linkCall[0]?.contexts).toEqual(['link']);
    });

    it('should create image and selection menus', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Find image menu
      const imageCall = createCalls.find(
        (call: any) => call[0]?.id === 'image',
      );
      expect(imageCall, 'image menu should be created').toBeDefined();
      expect(imageCall[0]?.title).toBe('Copy Image as Markdown');

      // Find selection menu
      const selectionCall = createCalls.find(
        (call: any) => call[0]?.id === 'selection-as-markdown',
      );
      expect(selectionCall, 'selection menu should be created').toBeDefined();
      expect(selectionCall[0]?.title).toBe('Copy Selection as Markdown');
    });

    it('should create custom format menus for single links', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const customFormat = createMockCustomFormat('1', 'My Custom Format');

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async (context) => {
          if (context === 'single-link') {
            return [customFormat];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Find custom format menu for current-tab
      const customTabCall = createCalls.find(
        (call: any) => call[0]?.id === 'current-tab-custom-format-1',
      );
      expect(customTabCall, 'custom format menu for page should be created').toBeDefined();
      expect(customTabCall[0]?.title).toBe('Copy Page Link (My Custom Format)');

      // Find custom format menu for link
      const customLinkCall = createCalls.find(
        (call: any) => call[0]?.id === 'link-custom-format-1',
      );
      expect(customLinkCall, 'custom format menu for link should be created').toBeDefined();
      expect(customLinkCall[0]?.title).toBe('Copy Link (My Custom Format)');
    });

    it('should not create menus for custom formats with showInMenus=false', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const hiddenFormat = createMockCustomFormat('1', 'Hidden Format', false);

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async (context) => {
          if (context === 'single-link') {
            return [hiddenFormat];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Should not find custom format menu
      const customTabCall = createCalls.find(
        (call: any) => call[0]?.id === 'current-tab-custom-format-1',
      );
      expect(customTabCall).toBeUndefined();
    });

    it('should attempt to create Firefox-specific menus', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert - should attempt to update current-tab menu for 'tab' context
      const updateCalls = updateMock.mock.calls;
      const updateCurrentTabCall = updateCalls.find(
        (call: any) => call[0] === 'current-tab',
      );

      expect(updateCurrentTabCall, 'should attempt to update current-tab menu for tab context').toBeDefined();
      expect(updateCurrentTabCall[1]?.contexts).toEqual(['page', 'tab']);
    });

    it('should create all tabs menus when Firefox features are supported', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Should create all-tabs menus
      const allTabsCall = createCalls.find(
        (call: any) => call[0]?.id === 'all-tabs-list',
      );
      expect(allTabsCall, 'all-tabs-list menu should be created').toBeDefined();

      const allTabsTaskCall = createCalls.find(
        (call: any) => call[0]?.id === 'all-tabs-task-list',
      );
      expect(allTabsTaskCall, 'all-tabs-task-list menu should be created').toBeDefined();

      // Should create highlighted tabs menus
      const highlightedCall = createCalls.find(
        (call: any) => call[0]?.id === 'highlighted-tabs-list',
      );
      expect(highlightedCall, 'highlighted-tabs-list menu should be created').toBeDefined();
    });
  });

  describe('refresh', () => {
    it('should be an alias for createAll', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.refresh();

      // Assert
      expect(removeAllMock).toHaveBeenCalledTimes(1);
      expect(createMock.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('integration: with custom formats', () => {
    it('should create menus for both single and multiple link formats', async () => {
      // Arrange
      const createMock = vi.fn(() => {});
      const updateMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => {});

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        update: updateMock,
        removeAll: removeAllMock,
      };

      const singleFormat = createMockCustomFormat('1', 'Single Format');
      const multipleFormat = createMockCustomFormat('2', 'Multiple Format');

      const mockFormatsProvider: CustomFormatsProvider = {
        list: vi.fn(async (context) => {
          if (context === 'single-link') {
            return [singleFormat];
          }
          if (context === 'multiple-links') {
            return [multipleFormat];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = createMock.mock.calls;

      // Should have single link custom format menus
      const singleLinkMenu = createCalls.find(
        (call: any) => call[0]?.id === 'current-tab-custom-format-1',
      );
      expect(singleLinkMenu, 'single link custom format menu should be created').toBeDefined();

      // Should have multiple links custom format menus
      const allTabsCustomMenu = createCalls.find(
        (call: any) => call[0]?.id === 'all-tabs-custom-format-2',
      );
      expect(allTabsCustomMenu, 'all-tabs custom format menu should be created').toBeDefined();
    });
  });
});
