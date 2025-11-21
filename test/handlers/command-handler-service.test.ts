import { describe, expect, it, vi } from 'vitest';
import { createKeyboardCommandHandler } from '../../src/handlers/keyboard-command-handler.js';
import type { TabsAPI } from '../../src/services/shared-types.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';
import type { SelectionConverterService } from '../../src/services/selection-converter-service.js';

interface Services {
  linkExportService: LinkExportService;
  tabExportService: TabExportService;
  selectionConverterService: SelectionConverterService;
}

function createMockTab(overrides?: Partial<browser.tabs.Tab>): browser.tabs.Tab {
  return {
    id: 1,
    title: 'Test Tab',
    url: 'https://example.com',
    windowId: 100,
    ...overrides,
  } as browser.tabs.Tab;
}

function createServices(overrides?: Partial<Services>): Services {
  return {
    linkExportService: {
      exportLink: vi.fn().mockRejectedValue(new Error('linkExportService should not be called')),
    },
    tabExportService: {
      exportTabs: vi.fn().mockRejectedValue(new Error('tabExportService should not be called')),
    },
    selectionConverterService: {
      convertSelectionToMarkdown: vi.fn().mockRejectedValue(new Error('selectionConverterService should not be called')),
    },
    ...overrides,
  } as Services;
}

describe('keyboardCommandHandler', () => {
  it('uses provided tab without querying', async () => {
    const providedTab = createMockTab();
    const queryMock = vi.fn().mockRejectedValue(new Error('should not query'));
    const tabsAPI: TabsAPI = { query: queryMock };
    const convertMock = vi.fn(async () => 'md');

    const handler = createKeyboardCommandHandler(tabsAPI, createServices({
      selectionConverterService: { convertSelectionToMarkdown: convertMock },
    }));

    await handler.handleCommand('selection-as-markdown', providedTab);
    expect(queryMock).not.toHaveBeenCalled();
    expect(convertMock).toHaveBeenCalledWith(providedTab);
  });

  it('queries current tab when none provided', async () => {
    const tab = createMockTab();
    const tabsAPI: TabsAPI = { query: vi.fn(async () => [tab]) };
    const convertMock = vi.fn(async () => 'md');

    const handler = createKeyboardCommandHandler(tabsAPI, createServices({
      selectionConverterService: { convertSelectionToMarkdown: convertMock },
    }));

    await handler.handleCommand('selection-as-markdown');
    expect(tabsAPI.query).toHaveBeenCalled();
    expect(convertMock).toHaveBeenCalledWith(tab);
  });

  it('maps current-tab-link command', async () => {
    const tab = createMockTab({ title: 'Title', url: 'https://example.com' });
    const exportLinkMock = vi.fn(async () => '[Title]');
    const handler = createKeyboardCommandHandler(
      { query: vi.fn(async () => [tab]) },
      createServices({ linkExportService: { exportLink: exportLinkMock } }),
    );

    const result = await handler.handleCommand('current-tab-link', tab);
    expect(result).toBe('[Title]');
    expect(exportLinkMock).toHaveBeenCalledWith({
      format: 'link',
      title: 'Title',
      url: 'https://example.com',
    });
  });

  it('maps built-in tab export commands', async () => {
    const tab = createMockTab({ windowId: 7 });
    const exportTabsMock = vi.fn(async () => 'tabs');
    const handler = createKeyboardCommandHandler(
      { query: vi.fn(async () => [tab]) },
      createServices({ tabExportService: { exportTabs: exportTabsMock } }),
    );

    const result = await handler.handleCommand('all-tabs-link-as-list', tab);
    expect(result).toBe('tabs');
    expect(exportTabsMock).toHaveBeenCalledWith({
      scope: 'all',
      format: 'link',
      listType: 'list',
      windowId: 7,
    });
  });

  it('maps custom format commands', async () => {
    const tab = createMockTab({ windowId: 2, title: 'T', url: 'u' });
    const exportLinkMock = vi.fn(async () => 'custom link');
    const exportTabsMock = vi.fn(async () => 'custom tabs');

    const handler = createKeyboardCommandHandler(
      { query: vi.fn(async () => [tab]) },
      createServices({
        linkExportService: { exportLink: exportLinkMock },
        tabExportService: { exportTabs: exportTabsMock },
      }),
    );

    expect(await handler.handleCommand('current-tab-custom-format-1', tab)).toBe('custom link');
    expect(exportLinkMock).toHaveBeenCalledWith({
      format: 'custom-format',
      customFormatSlot: '1',
      title: 'T',
      url: 'u',
    });

    expect(await handler.handleCommand('all-tabs-custom-format-2', tab)).toBe('custom tabs');
    expect(exportTabsMock).toHaveBeenCalledWith({
      scope: 'all',
      format: 'custom-format',
      customFormatSlot: '2',
      windowId: 2,
    });
  });

  it('throws on unknown command', async () => {
    const tab = createMockTab();
    const handler = createKeyboardCommandHandler(
      { query: vi.fn(async () => [tab]) },
      createServices(),
    );

    await expect(handler.handleCommand('nope', tab)).rejects.toThrow(/unknown keyboard command/);
  });
});
