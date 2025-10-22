import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { Options as TurndownOptions } from 'turndown';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

describe('selectionConverterService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      expect(executeScriptMock).toHaveBeenNthCalledWith(1, {
        target: {
          tabId: 123,
          allFrames: true,
        },
        files: ['dist/vendor/turndown.js'],
      });

      // Second call: execute conversion
      expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        target: {
          tabId: 123,
          allFrames: true,
        },
        func: selectionToMarkdown,
        args: [turndownOptions],
      }));
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
        executeScript: vi.fn().mockRejectedValue(new Error('Should not be called')),
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

      await expect(service.convertSelectionToMarkdown(tab)).rejects.toThrow('tab has no id');
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
      expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        args: [{
          headingStyle: 'setext',
          bulletListMarker: '*',
          customOption: 'value',
        }],
      }));
    });
  });
});
