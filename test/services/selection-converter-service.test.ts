import { describe, expect, it, vi } from 'vitest';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { Options as TurndownOptions } from 'turndown';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';

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
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
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
      expect(executeScriptMock).toHaveBeenCalledTimes(1);

      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 123,
          allFrames: true,
        },
        func: selectionToMarkdown,
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          turndownOptions,
          true,
        ],
      }));
    });

    it('returns only the single non-empty frame result without joining', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: '' },
        { result: 'Focused frame content' },
        { result: '' },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
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

      expect(result).toBe('Focused frame content');
    });

    it('targets the given frame and disables the focus filter when a frameId is provided', async () => {
      const executeScriptMock = vi.fn(async () => [{ result: 'Frame 7 markdown' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 555,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab, 7);

      expect(result).toBe('Frame 7 markdown');
      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 555,
          frameIds: [7],
        },
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          { headingStyle: 'atx' },
          false,
        ],
      }));
    });

    it('treats frameId 0 (main frame) as an explicit frame, not "no frame"', async () => {
      const executeScriptMock = vi.fn(async () => [{ result: 'Main frame markdown' }]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 556,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      await service.convertSelectionToMarkdown(tab, 0);

      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        target: {
          tabId: 556,
          frameIds: [0],
        },
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          { headingStyle: 'atx' },
          false,
        ],
      }));
    });

    it('returns the single non-empty result and ignores empty frames', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: '# Astro A20 X' },
        { result: '' },
        { result: '' },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 457,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab);

      expect(result).toBe('# Astro A20 X');
    });

    it('returns empty string when no frame has a selection', async () => {
      const executeScriptMock = vi.fn(async () => [
        { result: '' },
        { result: '' },
      ]);

      const mockScriptingAPI: ScriptingAPI = {
        executeScript: executeScriptMock,
      };

      const mockTurndownOptionsProvider: TurndownOptionsProvider = {
        getTurndownOptions: () => ({ headingStyle: 'atx' }),
      };

      const service = createSelectionConverterService(
        mockScriptingAPI,
        mockTurndownOptionsProvider,
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
      );

      const tab: browser.tabs.Tab = {
        id: 458,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        mutedInfo: { muted: false },
      };

      const result = await service.convertSelectionToMarkdown(tab);

      expect(result).toBe('');
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
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
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
        'dist/vendor/turndown.mjs',
        'dist/vendor/turndown-plugin-gfm.mjs',
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
      expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        args: [
          'dist/vendor/turndown.mjs',
          'dist/vendor/turndown-plugin-gfm.mjs',
          {
            headingStyle: 'setext',
            bulletListMarker: '*',
            customOption: 'value',
          },
          true,
        ],
      }));
    });
  });
});
