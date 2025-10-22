import { describe, expect, it, vi } from 'vitest';
import { createClipboardService } from '../../src/services/clipboard-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type {
  ClipboardAPI,
  TabsAPI,
} from '../../src/services/clipboard-service.js';
import copy from '../../src/content-script.js';

function createUnusedScriptingAPI(): ScriptingAPI {
  return {
    executeScript: vi.fn(async () => {
      throw new Error('ScriptingAPI.executeScript should not be called in this test');
    }),
  };
}

function createUnusedTabsAPI(): TabsAPI {
  return {
    query: vi.fn(async () => {
      throw new Error('TabsAPI.query should not be called in this test');
    }),
  };
}

describe('clipboardService', () => {
  describe('copy', () => {
    it('should use content script when clipboardAPI is null', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: { ok: true, method: 'navigator_api' } },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const service = createClipboardService(
        mockScriptingAPI,
        createUnusedTabsAPI(),
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      const tab: browser.tabs.Tab = {
        id: 123,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      await service.copy('test text', tab);

      expect(executeScriptMock).toHaveBeenCalledExactlyOnceWith({
        target: {
          tabId: 123,
        },
        args: [
          'test text',
          'chrome-extension://id/dist/static/iframe-copy.html',
        ],
        func: copy,
      });
    });

    it('should use clipboardAPI when provided', async () => {
      const writeTextMock = vi.fn<(text: string) => Promise<void>>(async () => { });
      const mockClipboardAPI: ClipboardAPI = {
        writeText: writeTextMock,
      };

      const service = createClipboardService(
        createUnusedScriptingAPI(),
        createUnusedTabsAPI(),
        mockClipboardAPI,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      await service.copy('test text');

      expect(writeTextMock).toHaveBeenCalledExactlyOnceWith('test text');
    });

    it('should get current tab when tab is not provided', async () => {
      const queryMock = vi.fn(async () => [
        {
          id: 456,
          index: 0,
          pinned: false,
          highlighted: false,
          windowId: 1,
          active: true,
          incognito: false,
          mutedInfo: { muted: false },
        },
      ]);

      const executeScriptMock = vi.fn(async () => [
        { result: { ok: true, method: 'navigator_api' } },
      ]);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const service = createClipboardService(
        mockScriptingAPI,
        mockTabsAPI,
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      await service.copy('test text');

      expect(queryMock).toHaveBeenCalledExactlyOnceWith({
        currentWindow: true,
        active: true,
      });

      expect(executeScriptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            tabId: 456,
          }),
        }),
      );
    });

    it('should throw error when tab has no id', async () => {
      const service = createClipboardService(
        createUnusedScriptingAPI(),
        createUnusedTabsAPI(),
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      const tab: browser.tabs.Tab = {
        id: undefined,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      expect(
        async () => service.copy('test text', tab),
        { message: 'tab has no id' },
      );
    });

    it('should throw error when content script fails', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: { ok: false, error: 'Permission denied', method: 'navigator_api' } },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const service = createClipboardService(
        mockScriptingAPI,
        createUnusedTabsAPI(),
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      const tab: browser.tabs.Tab = {
        id: 123,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
      };

      expect(
        async () => service.copy('test text', tab),
        { message: 'content script failed: Permission denied (method = navigator_api)' },
      );
    });

    it('should throw error when current tab query returns no tabs', async () => {
      const queryMock = vi.fn(async () => []);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const service = createClipboardService(
        createUnusedScriptingAPI(),
        mockTabsAPI,
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      expect(
        async () => service.copy('test text'),
        { message: 'failed to get current tab' },
      );
    });

    it('should throw error when executeScript returns no results', async () => {
      const executeScriptMock = vi.fn(async () => []);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const service = createClipboardService(
        mockScriptingAPI,
        createUnusedTabsAPI(),
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      const tab: browser.tabs.Tab = {
        id: 123,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      expect(
        async () => service.copy('test text', tab),
        { message: 'no result from content script' },
      );
    });
  });
});
