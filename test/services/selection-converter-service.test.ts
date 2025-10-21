import { describe, expect, it, vi } from 'vitest';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { Options as TurndownOptions } from 'turndown';

describe('selectionConverterService', () => {
  describe('convertSelectionToMarkdown', () => {
    it('should load turndown library and execute conversion', async () => {
      const executeScriptMock = vi.fn(async () => [
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

      expect(result).toBe('# Heading\n\nParagraph');
      expect(executeScriptMock).toHaveBeenCalledTimes(2);

      // First call: load turndown library
      const firstCall = executeScriptMock.mock.calls[0]!;
      expect(firstCall[0]!.target.tabId).toBe(123);
      expect(firstCall[0]!.target.allFrames).toBe(true);
      expect(firstCall[0]!.files).toEqual(['dist/vendor/turndown.js']);

      // Second call: execute conversion
      const secondCall = executeScriptMock.mock.calls[1]!;
      expect(secondCall[0]!.target.tabId).toBe(123);
      expect(secondCall[0]!.target.allFrames).toBe(true);
      expect(typeof secondCall[0]!.func === 'function').toBeTruthy();
      expect(secondCall[0]!.args).toEqual([turndownOptions]);
    });

    it('should join results from multiple frames with double newlines', async () => {
      const executeScriptMock = vi.fn(async (options: any) => {
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

      expect(result).toBe('Frame 1 content\n\nFrame 2 content\n\nFrame 3 content');
    });

    it('should throw error when tab has no id', async () => {
      const mockScriptingAPI: ScriptingAPI = {
        executeScript: vi.fn(async () => {
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

      await expect(
        async () => service.convertSelectionToMarkdown(tab),
        { message: 'tab has no id' },
      );
    });

    it('should use turndown options from provider', async () => {
      const getTurndownOptionsMock = vi.fn(() => ({
        headingStyle: 'setext' as const,
        bulletListMarker: '*' as const,
        customOption: 'value',
      }));

      const executeScriptMock = vi.fn(async () => [{ result: 'converted' }]);

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

      expect(getTurndownOptionsMock).toHaveBeenCalledTimes(1);

      // Check that options were passed to the conversion function
      const conversionCall = executeScriptMock.mock.calls[1]!;
      expect(conversionCall[0]!.args).toEqual([{
        headingStyle: 'setext',
        bulletListMarker: '*',
        customOption: 'value',
      }]);
    });
  });
});
