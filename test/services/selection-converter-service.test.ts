import { describe, expect, it, vi } from 'vitest';
import { createSelectionConverterService } from '../../src/services/selection-converter-service.js';
import type { ScriptingAPI } from '../../src/services/shared-types.js';
import type { TurndownOptionsProvider } from '../../src/services/selection-converter-service.js';
import type { MarkdownConverter } from '../../src/services/markdown-converter.js';
import type { Options as TurndownOptions } from 'turndown';
import { extractSelectionHtml } from '../../src/content-scripts/selection-to-markdown.js';

function makeTab(id: number | undefined): browser.tabs.Tab {
  return {
    id,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: true,
    incognito: false,
    mutedInfo: { muted: false },
  } as browser.tabs.Tab;
}

function makeConverter(impl?: (html: string, opts: TurndownOptions) => Promise<string>) {
  const convert = vi.fn(impl ?? (async (html: string) => `MD(${html})`));
  const converter: MarkdownConverter = { convert };
  return { converter, convert };
}

describe('selectionConverterService', () => {
  it('extracts HTML in all frames with the focus filter, then converts the single non-empty frame', async () => {
    const executeScript = vi.fn(async () => [{ result: '' }, { result: '<h1>Hi</h1>' }, { result: '' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const turndownOptions: TurndownOptions = { headingStyle: 'atx', bulletListMarker: '-' };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => turndownOptions };
    const { converter, convert } = makeConverter(async () => '# Hi');

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    const result = await service.convertSelectionToMarkdown(makeTab(123));

    expect(result).toBe('# Hi');
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 123, allFrames: true },
      func: extractSelectionHtml,
      args: [true],
    }));
    expect(convert).toHaveBeenCalledWith('<h1>Hi</h1>', turndownOptions);
  });

  it('targets the given frame and disables the focus filter when a frameId is provided', async () => {
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter(async () => 'x');

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(555), 7);

    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 555, frameIds: [7] },
      func: extractSelectionHtml,
      args: [false],
    }));
  });

  it('treats frameId 0 (main frame) as an explicit frame, not "no frame"', async () => {
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(556), 0);

    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 556, frameIds: [0] },
      args: [false],
    }));
  });

  it('returns empty string and does not convert when no frame has a selection', async () => {
    const executeScript = vi.fn(async () => [{ result: '' }, { result: '' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter, convert } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    const result = await service.convertSelectionToMarkdown(makeTab(458));

    expect(result).toBe('');
    expect(convert).not.toHaveBeenCalled();
  });

  it('uses turndown options from the provider', async () => {
    const getTurndownOptions = vi.fn(() => ({ headingStyle: 'setext' as const, bulletListMarker: '*' as const }));
    const executeScript = vi.fn(async () => [{ result: '<p>x</p>' }]);
    const scriptingAPI: ScriptingAPI = { executeScript };
    const provider: TurndownOptionsProvider = { getTurndownOptions };
    const { converter, convert } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await service.convertSelectionToMarkdown(makeTab(789));

    expect(getTurndownOptions).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith('<p>x</p>', { headingStyle: 'setext', bulletListMarker: '*' });
  });

  it('throws when the tab has no id', async () => {
    const scriptingAPI: ScriptingAPI = { executeScript: vi.fn().mockRejectedValue(new Error('nope')) };
    const provider: TurndownOptionsProvider = { getTurndownOptions: () => ({ headingStyle: 'atx' }) };
    const { converter } = makeConverter();

    const service = createSelectionConverterService(scriptingAPI, provider, converter);
    await expect(service.convertSelectionToMarkdown(makeTab(undefined))).rejects.toThrow('tab has no id');
  });
});
