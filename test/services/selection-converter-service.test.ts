import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { Options as TurndownOptions } from 'turndown';

describe('SelectionConverterService', () => {
  describe('convertSelectionToMarkdown', () => {
    it('should load turndown library and execute conversion', async () => {
      const executeScriptMock = mock.fn(async () => [
        { result: '# Heading\n\nParagraph' },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const turndownOptions: TurndownOptions = {
        headingStyle: 'atx',
        bulletListMarker: '-',
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => turndownOptions,
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.js',
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

      const result = await service.convertSelectionToMarkdown(tab);

      assert.equal(result, '# Heading\n\nParagraph');
      assert.equal(executeScriptMock.mock.calls.length, 2);

      // First call: load turndown library
      const firstCall = executeScriptMock.mock.calls[0]!;
      assert.equal(firstCall.arguments[0]!.target.tabId, 123);
      assert.equal(firstCall.arguments[0]!.target.allFrames, true);
      assert.deepEqual(firstCall.arguments[0]!.files, ['dist/vendor/turndown.js']);

      // Second call: execute conversion
      const secondCall = executeScriptMock.mock.calls[1]!;
      assert.equal(secondCall.arguments[0]!.target.tabId, 123);
      assert.equal(secondCall.arguments[0]!.target.allFrames, true);
      assert.ok(typeof secondCall.arguments[0]!.func === 'function');
      assert.deepEqual(secondCall.arguments[0]!.args, [turndownOptions]);
    });

    it('should join results from multiple frames with double newlines', async () => {
      const executeScriptMock = mock.fn(async (options: any) => {
        if (options.files) {
          // Load turndown script
          return [];
        }
        // Execute conversion - return multiple frame results
        return [
          { result: 'Frame 1 content' },
          { result: 'Frame 2 content' },
          { result: 'Frame 3 content' },
        ];
      });

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.js',
      );

      const tab: browser.tabs.Tab = {
        id: 456,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab);

      assert.equal(result, 'Frame 1 content\n\nFrame 2 content\n\nFrame 3 content');
    });

    it('should throw error when tab has no id', async () => {
      const mockScriptingAPI: ScriptingAPI = {
        executeScript: mock.fn(async () => {
          throw new Error('Should not be called');
        }),
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.js',
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
        async () => service.convertSelectionToMarkdown(tab),
        { message: 'tab has no id' },
      );
    });

    it('should use turndown options from provider', async () => {
      const getTurndownOptionsMock = mock.fn(() => ({
        headingStyle: 'setext' as const,
        bulletListMarker: '*' as const,
        customOption: 'value',
      }));

      const executeScriptMock = mock.fn(async () => [{ result: 'converted' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: getTurndownOptionsMock,
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.js',
      );

      const tab: browser.tabs.Tab = {
        id: 789,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      await service.convertSelectionToMarkdown(tab);

      assert.equal(getTurndownOptionsMock.mock.calls.length, 1);

      // Check that options were passed to the conversion function
      const conversionCall = executeScriptMock.mock.calls[1]!;
      assert.deepEqual(conversionCall.arguments[0]!.args, [{
        headingStyle: 'setext',
        bulletListMarker: '*',
        customOption: 'value',
      }]);
    });

    it('should use custom turndown script URL', async () => {
      const executeScriptMock = mock.fn(async () => [{ result: 'test' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({}),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'custom/path/to/turndown.js',
      );

      const tab: browser.tabs.Tab = {
        id: 999,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      await service.convertSelectionToMarkdown(tab);

      const loadScriptCall = executeScriptMock.mock.calls[0]!;
      assert.deepEqual(loadScriptCall.arguments[0]!.files, ['custom/path/to/turndown.js']);
    });
  });
});
