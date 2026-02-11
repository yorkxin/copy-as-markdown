/**
 * Unit tests for context menu service
 */

import { describe, expect, it, vi } from 'vitest';
import { createContextMenuService } from '../../src/services/context-menu-service.js';
import type {
  ContextMenusAPI,
} from '../../src/services/shared-types.js';
import type {
  CustomFormatsListProvider,
} from '../../src/services/context-menu-service.js';
import type { BuiltInStyleSettings } from '../../src/lib/built-in-style-settings.js';

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
  function makeBuiltInProvider(overrides: Partial<BuiltInStyleSettings> = {}) {
    const defaults: BuiltInStyleSettings = {
      singleLink: true,
      tabLinkList: true,
      tabTaskList: true,
      tabTitleList: false,
      tabUrlList: false,
    };
    return {
      getAll: vi.fn(async () => ({ ...defaults, ...overrides })),
    };
  }

  describe('createAll', () => {
    it('should remove all existing menus first', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(removeAllMock).toHaveBeenCalledTimes(1);
    });

    it('should create basic menus (current-tab and link)', async () => {
      // Arrange
      const createMock = vi.fn(({ id }) => {
        if (id === 'tmp-tab' || id === 'tmp-bookmark') {
          throw TypeError;
        }
      });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab',
          title: 'Copy Page Link as Markdown',
          contexts: ['page'],
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'link',
          title: 'Copy Link as Markdown',
          contexts: ['link'],
        }),
      );
    });

    it('should create image and selection menus', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'image',
          title: 'Copy Image as Markdown',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'selection-as-markdown',
          title: 'Copy Selection as Markdown',
        }),
      );
    });

    it('should create custom format menus for single links', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const customFormat = createMockCustomFormat('1', 'My Custom Format');

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async (context: 'single-link' | 'multiple-links') => {
          if (context === 'single-link') {
            return [customFormat];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab-custom-format-1',
          title: 'Copy Page Link (My Custom Format)',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'link-custom-format-1',
          title: 'Copy Link (My Custom Format)',
        }),
      );
    });

    it('should not create menus for custom formats with showInMenus=false', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const hiddenFormat = createMockCustomFormat('1', 'Hidden Format', false);

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async (context) => {
          if (context === 'single-link') {
            return [hiddenFormat];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab-custom-format-1',
        }),
      );
    });

    it('should attempt to create Firefox-specific menus', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => {});
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert - should attempt to create current-tab menu for 'tab' context
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab',
          contexts: ['page', 'tab'],
        }),
      );
    });

    it('should create all tabs menus when Firefox features are supported', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'all-tabs-link-as-list',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'all-tabs-link-as-task-list',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'highlighted-tabs-link-as-list',
        }),
      );
    });

    it('should create all built-in tab menus when enabled', async () => {
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const builtIns = makeBuiltInProvider({
        tabLinkList: true,
        tabTaskList: true,
        tabTitleList: true,
        tabUrlList: true,
      });
      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, builtIns);

      await service.createAll();

      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'all-tabs-link-as-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'all-tabs-link-as-task-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'all-tabs-title-as-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'all-tabs-url-as-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'highlighted-tabs-link-as-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'highlighted-tabs-link-as-task-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'highlighted-tabs-title-as-list' }));
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'highlighted-tabs-url-as-list' }));
    });
  });

  describe('refresh', () => {
    it('should be an alias for createAll', async () => {
      // Arrange
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const mockFormatsProvider: CustomFormatsListProvider = {
        list: vi.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

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
      const createMock = vi.fn(() => { });
      const removeMock = vi.fn(async () => { });
      const removeAllMock = vi.fn(async () => { });

      const mockMenusAPI: ContextMenusAPI = {
        create: createMock,
        remove: removeMock,
        removeAll: removeAllMock,
      };

      const singleFormat = createMockCustomFormat('1', 'Single Format');
      const multipleFormat = createMockCustomFormat('2', 'Multiple Format');

      const mockFormatsProvider: CustomFormatsListProvider = {
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

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider, makeBuiltInProvider());

      // Act
      await service.createAll();

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab-custom-format-1',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'all-tabs-custom-format-2',
        }),
      );
    });
  });
});
