/**
 * Unit tests for tab export service
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createTabExportService } from '../../src/services/tab-export-service.js';
import type {
  CustomFormatsProvider,
  MarkdownFormatter,
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
    render: mock.fn(() => renderOutput),
  };
}

describe('TabExportService', () => {
  describe('exportTabs - basic functionality', () => {
    it('should export all tabs as markdown link list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      const mockWindowsAPI: WindowsAPI = {
        create: mock.fn(async () => ({} as any)),
      };

      const mockMarkdown = new MockMarkdown();

      const mockCustomFormatsProvider: CustomFormatsProvider = {
        get: mock.fn(async () => createMockCustomFormat() as any),
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
      assert.ok(result.includes('[GitHub](https://github.com)'));
      assert.ok(result.includes('[Twitter](https://twitter.com)'));
    });

    it('should query only highlighted tabs when scope is highlighted', async () => {
      // Arrange
      const queryMock = mock.fn(async () => [
        { title: 'GitHub', url: 'https://github.com', groupId: -1 },
      ] as any);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      await service.exportTabs({
        scope: 'highlighted',
        format: 'link',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      const queryCall = queryMock.mock.calls[0]!;
      assert.strictEqual(queryCall.arguments[0].highlighted, true);
      assert.strictEqual(queryCall.arguments[0].windowId, 1);
    });
  });

  describe('exportTabs - different formats', () => {
    it('should export tabs as title-only list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      assert.ok(result.includes('GitHub'));
      assert.ok(result.includes('Twitter'));
      assert.ok(!result.includes('https://'));
    });

    it('should export tabs as URL-only list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'url',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      assert.ok(result.includes('https://github.com'));
      assert.ok(!result.includes('['));
    });
  });

  describe('exportTabs - list types', () => {
    it('should export as task list when listType is task-list', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      const taskListMock = mock.fn((items: any[]) => items.map(i => `- [ ] ${i}\n`).join(''));
      const listMock = mock.fn((items: any[]) => items.map(i => `- ${i}\n`).join(''));

      const mockMarkdown: MarkdownFormatter = {
        escapeLinkText: (text: string) => text,
        linkTo: (title: string, url: string) => `[${title}](${url})`,
        taskList: taskListMock,
        list: listMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
        () => null,
        mockMarkdown,
        {} as any,
      );

      // Act
      await service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'task-list',
        windowId: 1,
      });

      // Assert
      assert.strictEqual(taskListMock.mock.calls.length, 1);
      assert.strictEqual(listMock.mock.calls.length, 0);
    });
  });

  describe('exportTabs - permissions', () => {
    it('should throw error if tabs permission is not granted', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => []),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => false),
      };

      const createMock = mock.fn(async () => ({} as any));

      const mockWindowsAPI: WindowsAPI = {
        create: createMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        mockWindowsAPI,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act & Assert
      await assert.rejects(
        () => service.exportTabs({
          scope: 'all',
          format: 'link',
          listType: 'list',
          windowId: 1,
        }),
        /Tabs permission required/,
      );

      // Should open permission dialog
      assert.strictEqual(createMock.mock.calls.length, 1);
    });

    it('should check for tabs permission', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => []),
      };

      const containsMock = mock.fn(async () => true);

      const mockPermissionsAPI: PermissionsAPI = {
        contains: containsMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      await service.exportTabs({
        scope: 'all',
        format: 'link',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      const permissionCall = containsMock.mock.calls[0]!;
      assert.deepStrictEqual(
        permissionCall.arguments[0],
        { permissions: ['tabs'] },
      );
    });
  });

  describe('exportTabs - custom formats', () => {
    it('should render custom format when format is custom-format', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
          { title: 'Twitter', url: 'https://twitter.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async () => true),
      };

      // Mock custom format that will be returned by the provider
      const mockCustomFormat = createMockCustomFormat('Custom: 2 links');

      const getMock = mock.fn(async () => mockCustomFormat as any);

      const mockCustomFormatsProvider: CustomFormatsProvider = {
        get: getMock,
      };

      const service = createTabExportService(
        mockTabsAPI,
        mockPermissionsAPI,
        {} as any,
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
      assert.strictEqual(result, 'Custom: 2 links');
      assert.strictEqual(getMock.mock.calls.length, 1);
      assert.deepStrictEqual(
        getMock.mock.calls[0]!.arguments,
        ['multiple-links', '1'],
      );
    });

    it('should throw error if custom format is used without customFormatSlot', async () => {
      // Arrange
      const service = createTabExportService(
        {} as any,
        {} as any,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act & Assert
      await assert.rejects(
        () => service.exportTabs({
          scope: 'all',
          format: 'custom-format',
          windowId: 1,
        }),
        /customFormatSlot is required/,
      );
    });

    it('should throw error if custom format is used with listType', async () => {
      // Arrange
      const service = createTabExportService(
        {} as any,
        {} as any,
        {} as any,
        () => null,
        new MockMarkdown(),
        {} as any,
      );

      // Act & Assert
      await assert.rejects(
        () => service.exportTabs({
          scope: 'all',
          format: 'custom-format',
          customFormatSlot: '1',
          listType: 'list',
          windowId: 1,
        }),
        /listType is not allowed if format is custom-format/,
      );
    });
  });

  describe('exportTabs - tab groups', () => {
    it('should handle tab groups when available', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'Gmail', url: 'https://mail.google.com', groupId: 1 },
          { title: 'Calendar', url: 'https://calendar.google.com', groupId: 1 },
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async (perms) => {
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
        {} as any,
        () => mockTabGroupsAPI,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert
      assert.ok(result.includes('Work'));
      assert.ok(result.includes('Gmail'));
      assert.ok(result.includes('GitHub'));
    });

    it('should handle missing tab groups permission gracefully', async () => {
      // Arrange
      const mockTabsAPI: TabsAPI = {
        query: mock.fn(async () => [
          { title: 'GitHub', url: 'https://github.com', groupId: -1 },
        ] as any),
      };

      const mockPermissionsAPI: PermissionsAPI = {
        contains: mock.fn(async (perms) => {
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
        {} as any,
        () => mockTabGroupsAPI,
        new MockMarkdown(),
        {} as any,
      );

      // Act
      const result = await service.exportTabs({
        scope: 'all',
        format: 'title',
        listType: 'list',
        windowId: 1,
      });

      // Assert - should still work without groups
      assert.ok(result.includes('GitHub'));
    });
  });
});
