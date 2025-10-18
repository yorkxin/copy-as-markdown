import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createClipboardService } from '../../src/services/clipboard-service.js';
import type {
  ClipboardAPI,
  ScriptingAPI,
  TabsAPI,
} from '../../src/services/clipboard-service.js';

function createUnusedScriptingAPI(): ScriptingAPI {
  return {
    executeScript: mock.fn(async () => {
      throw new Error('ScriptingAPI.executeScript should not be called in this test');
    }),
  };
}

function createUnusedTabsAPI(): TabsAPI {
  return {
    query: mock.fn(async () => {
      throw new Error('TabsAPI.query should not be called in this test');
    }),
  };
}

describe('ClipboardService', () => {
  describe('copy', () => {
    it('should use content script when clipboardAPI is null', async () => {
      const executeScriptMock = mock.fn(async () => [
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

      assert.equal(executeScriptMock.mock.calls.length, 1);
      const call = executeScriptMock.mock.calls[0]!;
      assert.equal(call.arguments[0]!.target.tabId, 123);
      assert.equal(call.arguments[0]!.args[0], 'test text');
      assert.equal(call.arguments[0]!.args[1], 'chrome-extension://id/dist/static/iframe-copy.html');
    });

    it('should use clipboardAPI when provided', async () => {
      const writeTextMock = mock.fn<(text: string) => Promise<void>>(async () => {});
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

      assert.equal(writeTextMock.mock.calls.length, 1);
      assert.equal(writeTextMock.mock.calls[0]!.arguments[0], 'test text');
    });

    it('should get current tab when tab is not provided', async () => {
      const queryMock = mock.fn(async () => [
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

      const executeScriptMock = mock.fn(async () => [
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

      assert.equal(queryMock.mock.calls.length, 1);
      assert.deepEqual(queryMock.mock.calls[0]!.arguments[0], {
        currentWindow: true,
        active: true,
      });

      assert.equal(executeScriptMock.mock.calls.length, 1);
      assert.equal(executeScriptMock.mock.calls[0]!.arguments[0]!.target.tabId, 456);
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

      await assert.rejects(
        async () => service.copy('test text', tab),
        { message: 'tab has no id' },
      );
    });

    it('should throw error when content script fails', async () => {
      const executeScriptMock = mock.fn(async () => [
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

      await assert.rejects(
        async () => service.copy('test text', tab),
        { message: 'content script failed: Permission denied (method = navigator_api)' },
      );
    });

    it('should throw error when current tab query returns no tabs', async () => {
      const queryMock = mock.fn(async () => []);

      const mockTabsAPI: TabsAPI = {
        query: queryMock,
      };

      const service = createClipboardService(
        createUnusedScriptingAPI(),
        mockTabsAPI,
        null,
        'chrome-extension://id/dist/static/iframe-copy.html',
      );

      await assert.rejects(
        async () => service.copy('test text'),
        { message: 'failed to get current tab' },
      );
    });

    it('should throw error when executeScript returns no results', async () => {
      const executeScriptMock = mock.fn(async () => []);

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

      await assert.rejects(
        async () => service.copy('test text', tab),
        { message: 'no result from content script' },
      );
    });
  });
});
