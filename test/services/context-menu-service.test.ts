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
      expect(createMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-tab-custom-format-1',
        }),
      );
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
      expect(updateMock).toHaveBeenCalledWith(
        'current-tab',
        expect.objectContaining({
          contexts: ['page', 'tab'],
        }),
      );
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
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'all-tabs-list',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'all-tabs-task-list',
        }),
      );

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'highlighted-tabs-list',
        }),
      );
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
