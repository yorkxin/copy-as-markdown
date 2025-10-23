/**
 * Unit tests for tab export service
 */

import { describe, expect, it, vi } from 'vitest';
import { createTabExportService } from '../../src/services/tab-export-service.js';
import type {
  CustomFormatsProvider,
  MarkdownFormatter,
} from '../../src/services/shared-types.js';
import type {
  PermissionsAPI,
  TabGroupsAPI,
  TabsAPI,
  WindowsAPI,
} from '../../src/services/tab-export-service.js';

// Mock Markdown class implementing MarkdownFormatter interface
class MockMarkdown implements MarkdownFormatter {
  escapeLinkText(text: string): string {
    return text;
  }

  linkTo(title: string, url: string): string {
    return `[${title}](${url})`;
  }

  list(items: any[]): string {
    return items.map(item => `- ${item}\n`).join('');
  }

  taskList(items: any[]): string {
    return items.map(item => `- [ ] ${item}\n`).join('');
  }
}

// Helper to create a mock custom format object
function createMockCustomFormat(renderOutput: string = 'mocked output') {
  return {
    render: vi.fn(() => renderOutput),
  };
}

// Helpers to create unused mock stubs (for dependencies not used in specific tests)
// These throw errors if accidentally called, making test failures clear
function createUnusedTabsAPI(): TabsAPI {
  return {
    query: vi.fn().mockRejectedValue(new Error('TabsAPI.query should not be called in this test')),
  };
}

function createUnusedPermissionsAPI(): PermissionsAPI {
  return {
    contains: vi.fn().mockRejectedValue(new Error('PermissionsAPI.contains should not be called in this test')),
  };
}

function createUnusedWindowsAPI(): WindowsAPI {
  return {
    create: vi.fn().mockRejectedValue(new Error('WindowsAPI.create should not be called in this test')),
  };
}

function createUnusedCustomFormatsProvider(): CustomFormatsProvider {
  return {
    get: vi.fn().mockRejectedValue(new Error('CustomFormatsProvider.get should not be called in this test')),
  };
}

describe('tabExportService', () => {
  describe('exportTabs - basic functionality', () => {
    it('should export all tabs as markdown link list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      const mockWindowsAPI: WindowsAPI = {
        create: vi.fn(async () => ({} as any)),
      };

      const mockMarkdown = new MockMarkdown();

      const mockCustomFormatsProvider: CustomFormatsProvider = {
        get: vi.fn(async () => createMockCustomFormat() as any),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        mockWindowsAPI,
        () => null, // No tab groups
        mockMarkdown,
        mockCustomFormatsProvider,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(result.includes('[GitHub](https://github.com)')).toBeTruthy();
      expect(result.includes('[Twitter](https://twitter.com)')).toBeTruthy();
    });

    it('should query only highlighted tabs when scope is highlighted', async () => {
      // Arrange
      const queryMock = vi.fn(async () => [
        { title: 'GitHub', url: 'https://github.com', groupId: -1 },
      ] as any);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      await service.exportTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(queryMock).toHaveBeenCalledWith({
        highlighted: true,
        windowId: 1,
      });
    });
  });

  describe('exportTabs - different formats', () => {
    it('should export tabs as title-only list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(result.includes('GitHub')).toBeTruthy();
      expect(result.includes('Twitter')).toBeTruthy();
      expect(!result.includes('https://')).toBeTruthy();
    });

    it('should export tabs as URL-only list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'url',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(result.includes('https://github.com')).toBeTruthy();
      expect(!result.includes('[')).toBeTruthy();
    });
  });

  describe('exportTabs - list types', () => {
    it('should export as task list when listType is task-list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      const taskListMock = vi.fn((items: any[]) => items.map(i => `- [ ] ${i}\n`).join(''));
      const listMock = vi.fn((items: any[]) => items.map(i => `- ${i}\n`).join(''));

      const mockMarkdown: MarkdownFormatter = {
        escapeLinkText: (text: string) => text,
        linkTo: (title: string, url: string) => `[${title}](${url})`,
        taskList: taskListMock,
        list: listMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        mockMarkdown,
        createUnusedCustomFormatsProvider(),
      );

      // Act
      await service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'task-list',
        windowId: 1,
      });

      // Assert
      expect(taskListMock).toHaveBeenCalledTimes(1);
      expect(listMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('exportTabs - permissions', () => {
    it('should throw error if tabs permission is not granted', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => []),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => false),
      };

      const createMock = vi.fn(async () => ({} as any));

      const mockWindowsAPI: WindowsAPI = {
        create: createMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        mockWindowsAPI,
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act & Assert
      await expect(service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 1,
      })).rejects.toThrow(/Tabs permission required/);

      // Should open permission dialog
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    it('should check for tabs permission', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => []),
      };

      const containsMock = vi.fn(async () => true);

      const mockPermissionsAPI: PermissionsAPI = {
        contains: containsMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      await service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(containsMock).toHaveBeenCalledWith(
        { permissions: ['tabs'] },
      );
    });
  });

  describe('exportTabs - custom formats', () => {
    it('should render custom format when format is custom-format', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async () => true),
      };

      // Mock custom format that will be returned by the provider
      const mockCustomFormat = createMockCustomFormat('Custom: 2 links');

      const getMock = vi.fn(async () => mockCustomFormat as any);

      const mockCustomFormatsProvider: CustomFormatsProvider = {
        get: getMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        mockCustomFormatsProvider,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'custom-format',
        customFormatSlot: '1',
        windowId: 1,
      });

      // Assert
      expect(result).toBe('Custom: 2 links');
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('multiple-links', '1');
    });

    it('should throw error if custom format is used without customFormatSlot', async () => {
      // Arrange
      // These tests only validate options, so no APIs are actually called
      const service = createTabExportService(
        createUnusedTabsAPI(),
        createUnusedPermissionsAPI(),
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act & Assert
      await expect(service.exportTabs({
        scope: 'all',
        format: 'custom-format',
        windowId: 1,
      })).rejects.toThrow(/customFormatSlot is required/);
    });

    it('should throw error if custom format is used with listType', async () => {
      // Arrange
      // These tests only validate options, so no APIs are actually called
      const service = createTabExportService(
        createUnusedTabsAPI(),
        createUnusedPermissionsAPI(),
        createUnusedWindowsAPI(),
        () => null,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act & Assert
      await expect(service.exportTabs({
        scope: 'all',
        format: 'custom-format',
        customFormatSlot: '1',
        listType: 'list',
        windowId: 1,
      })).rejects.toThrow(/listType is not allowed if format is custom-format/);
    });
  });

  describe('exportTabs - tab groups', () => {
    it('should handle tab groups when available', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'Gmail', url: 'https://mail.google.com', groupId: 1 },
          { title: 'Calendar', url: 'https://calendar.google.com', groupId: 1 },
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async (perms) => {
          if (perms.permissions?.includes('tabGroups')) return true;
          if (perms.permissions?.includes('tabs')) return true;
          return false;
        }),
      };

      const mockTabGroupsAPI: TabGroupsAPI = {
        query: (_queryInfo, callback) => {
          callback([
            { id: 1, title: 'Work', color: 'blue' },
          ] as any);
        },
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => mockTabGroupsAPI,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      expect(result.includes('Work')).toBeTruthy();
      expect(result.includes('Gmail')).toBeTruthy();
      expect(result.includes('GitHub')).toBeTruthy();
    });

    it('should handle missing tab groups permission gracefully', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: vi.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: vi.fn(async (perms) => {
          if (perms.permissions?.includes('tabGroups')) return false;
          if (perms.permissions?.includes('tabs')) return true;
          return false;
        }),
      };

      const mockTabGroupsAPI: TabGroupsAPI = {
        query: (_queryInfo, callback) => {
          callback([]);
        },
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        createUnusedWindowsAPI(),
        () => mockTabGroupsAPI,
        new MockMarkdown(),
        createUnusedCustomFormatsProvider(),
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert - should still work without groups
      expect(result.includes('GitHub')).toBeTruthy();
    });
  });
});
