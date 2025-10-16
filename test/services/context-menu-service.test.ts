/**
 * Unit tests for context menu service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createContextMenuService } from '../../src/services/context-menu-service.js';
import type {
  ContextMenusAPI,
  CustomFormatsProvider,
} from '../../src/services/context-menu-service.js';

// Mock CustomFormat class
class MockCustomFormat {
  slot: string;
  name: string;
  showInMenus: boolean;

  constructor(slot: string, name: string, showInMenus: boolean = true) {
    this.slot = slot;
    this.name = name;
    this.showInMenus = showInMenus;
  }

  get displayName(): string {
    return this.name || `Custom Format ${this.slot}`;
  }
}

describe('ContextMenuService', () => {
  describe('createAll', () => {
    it('should remove all existing menus first', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      assert.strictEqual(
        (mockMenusAPI.removeAll as any).mock.calls.length,
        1,
        'removeAll should be called once',
      );
    });

    it('should create basic menus (current-tab and link)', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Find current-tab menu
      const currentTabCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'current-tab',
      );
      assert.ok(currentTabCall, 'current-tab menu should be created');
      assert.strictEqual(
        currentTabCall.arguments[0]?.title,
        'Copy Page Link as Markdown',
      );
      assert.deepStrictEqual(currentTabCall.arguments[0]?.contexts, ['page']);

      // Find link menu
      const linkCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'link',
      );
      assert.ok(linkCall, 'link menu should be created');
      assert.strictEqual(linkCall.arguments[0]?.title, 'Copy Link as Markdown');
      assert.deepStrictEqual(linkCall.arguments[0]?.contexts, ['link']);
    });

    it('should create image and selection menus', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Find image menu
      const imageCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'image',
      );
      assert.ok(imageCall, 'image menu should be created');
      assert.strictEqual(imageCall.arguments[0]?.title, 'Copy Image as Markdown');

      // Find selection menu
      const selectionCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'selection-as-markdown',
      );
      assert.ok(selectionCall, 'selection menu should be created');
      assert.strictEqual(
        selectionCall.arguments[0]?.title,
        'Copy Selection as Markdown',
      );
    });

    it('should create custom format menus for single links', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const customFormat = new MockCustomFormat('1', 'My Custom Format');

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async (context) => {
          if (context === 'single-link') {
            return [customFormat as any];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Find custom format menu for current-tab
      const customTabCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'current-tab-custom-format-1',
      );
      assert.ok(customTabCall, 'custom format menu for page should be created');
      assert.strictEqual(
        customTabCall.arguments[0]?.title,
        'Copy Page Link (My Custom Format)',
      );

      // Find custom format menu for link
      const customLinkCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'link-custom-format-1',
      );
      assert.ok(customLinkCall, 'custom format menu for link should be created');
      assert.strictEqual(
        customLinkCall.arguments[0]?.title,
        'Copy Link (My Custom Format)',
      );
    });

    it('should not create menus for custom formats with showInMenus=false', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const hiddenFormat = new MockCustomFormat('1', 'Hidden Format', false);

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async (context) => {
          if (context === 'single-link') {
            return [hiddenFormat as any];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Should not find custom format menu
      const customTabCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'current-tab-custom-format-1',
      );
      assert.strictEqual(
        customTabCall,
        undefined,
        'custom format with showInMenus=false should not be created',
      );
    });

    it('should attempt to create Firefox-specific menus', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert - should attempt to update current-tab menu for 'tab' context
      const updateCalls = (mockMenusAPI.update as any).mock.calls;
      const updateCurrentTabCall = updateCalls.find(
        (call: any) => call.arguments[0] === 'current-tab',
      );

      assert.ok(
        updateCurrentTabCall,
        'should attempt to update current-tab menu for tab context',
      );
      assert.deepStrictEqual(
        updateCurrentTabCall.arguments[1]?.contexts,
        ['page', 'tab'],
      );
    });

    it('should create all tabs menus when Firefox features are supported', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Should create all-tabs menus
      const allTabsCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'all-tabs-list',
      );
      assert.ok(allTabsCall, 'all-tabs-list menu should be created');

      const allTabsTaskCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'all-tabs-task-list',
      );
      assert.ok(allTabsTaskCall, 'all-tabs-task-list menu should be created');

      // Should create highlighted tabs menus
      const highlightedCall = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'highlighted-tabs-list',
      );
      assert.ok(highlightedCall, 'highlighted-tabs-list menu should be created');
    });
  });

  describe('refresh', () => {
    it('should be an alias for createAll', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async () => []),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.refresh();

      // Assert
      assert.strictEqual(
        (mockMenusAPI.removeAll as any).mock.calls.length,
        1,
        'removeAll should be called',
      );
      assert.ok(
        (mockMenusAPI.create as any).mock.calls.length > 0,
        'create should be called',
      );
    });
  });

  describe('Integration: with custom formats', () => {
    it('should create menus for both single and multiple link formats', async () => {
      // Arrange
      const mockMenusAPI: ContextMenusAPI = {
        create: mock.fn(() => {}),
        update: mock.fn(async () => {}),
        removeAll: mock.fn(async () => {}),
      };

      const singleFormat = new MockCustomFormat('1', 'Single Format');
      const multipleFormat = new MockCustomFormat('2', 'Multiple Format');

      const mockFormatsProvider: CustomFormatsProvider = {
        list: mock.fn(async (context) => {
          if (context === 'single-link') {
            return [singleFormat as any];
          }
          if (context === 'multiple-links') {
            return [multipleFormat as any];
          }
          return [];
        }),
      };

      const service = createContextMenuService(mockMenusAPI, mockFormatsProvider);

      // Act
      await service.createAll();

      // Assert
      const createCalls = (mockMenusAPI.create as any).mock.calls;

      // Should have single link custom format menus
      const singleLinkMenu = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'current-tab-custom-format-1',
      );
      assert.ok(singleLinkMenu, 'single link custom format menu should be created');

      // Should have multiple links custom format menus
      const allTabsCustomMenu = createCalls.find(
        (call: any) => call.arguments[0]?.id === 'all-tabs-custom-format-2',
      );
      assert.ok(
        allTabsCustomMenu,
        'all-tabs custom format menu should be created',
      );
    });
  });
});
