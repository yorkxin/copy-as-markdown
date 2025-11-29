import { describe, expect, it, vi } from 'vitest';
import { createContextMenuHandler } from '../../src/handlers/context-menu-handler.js';
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
    title: 'Tab',
    url: 'https://example.com',
    windowId: 10,
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

describe('contextMenuHandler', () => {
  it('exports current tab link', async () => {
    const exportLinkMock = vi.fn(async () => 'link');
    const handler = createContextMenuHandler(
      createServices({ linkExportService: { exportLink: exportLinkMock } }),
      () => ({ getSubTree: vi.fn() }),
      { toMarkdown: vi.fn() },
    );

    const result = await handler.handleMenuClick({ menuItemId: 'current-tab' } as any, createMockTab());
    expect(result).toBe('link');
    expect(exportLinkMock).toHaveBeenCalledWith({
      format: 'link',
      title: 'Tab',
      url: 'https://example.com',
    });
  });

  it('exports selection as markdown', async () => {
    const convertMock = vi.fn(async () => 'md');
    const handler = createContextMenuHandler(
      createServices({ selectionConverterService: { convertSelectionToMarkdown: convertMock } }),
      () => ({ getSubTree: vi.fn() }),
      { toMarkdown: vi.fn() },
    );

    const tab = createMockTab();
    const result = await handler.handleMenuClick({ menuItemId: 'selection-as-markdown' } as any, tab);
    expect(result).toBe('md');
    expect(convertMock).toHaveBeenCalledWith(tab);
  });

  it('exports highlighted tabs list', async () => {
    const exportTabsMock = vi.fn(async () => 'tabs');
    const handler = createContextMenuHandler(
      createServices({ tabExportService: { exportTabs: exportTabsMock } }),
      () => ({ getSubTree: vi.fn() }),
      { toMarkdown: vi.fn() },
    );

    const tab = createMockTab({ windowId: 5 });
    const result = await handler.handleMenuClick({ menuItemId: 'highlighted-tabs-link-as-list' } as any, tab);
    expect(result).toBe('tabs');
    expect(exportTabsMock).toHaveBeenCalledWith({
      scope: 'highlighted',
      format: 'link',
      listType: 'list',
      windowId: 5,
    });
  });

  it('exports bookmark link markdown', async () => {
    const bookmarkNode = {
      id: 'bm-1',
      title: 'Example',
      url: 'https://example.com',
    } as browser.bookmarks.BookmarkTreeNode;
    const getSubTreeMock = vi.fn().mockResolvedValue([bookmarkNode]);
    const toMarkdownMock = vi.fn(() => 'bookmark-md');
    const handler = createContextMenuHandler(
      createServices(),
      () => ({ getSubTree: getSubTreeMock }),
      { toMarkdown: toMarkdownMock },
    );

    const result = await handler.handleMenuClick({ menuItemId: 'bookmark-link', bookmarkId: 'bm-1' } as any);
    expect(result).toBe('bookmark-md');
    expect(getSubTreeMock).toHaveBeenCalledWith('bm-1');
    expect(toMarkdownMock).toHaveBeenCalledWith(bookmarkNode);
  });

  it('parses custom format for current tab', async () => {
    const exportLinkMock = vi.fn(async () => 'custom');
    const handler = createContextMenuHandler(
      createServices({ linkExportService: { exportLink: exportLinkMock } }),
      () => ({ getSubTree: vi.fn() }),
      { toMarkdown: vi.fn() },
    );

    const tab = createMockTab({ title: 'T', url: 'U' });
    const result = await handler.handleMenuClick({ menuItemId: 'current-tab-custom-format-2' } as any, tab);
    expect(result).toBe('custom');
    expect(exportLinkMock).toHaveBeenCalledWith({
      format: 'custom-format',
      customFormatSlot: '2',
      title: 'T',
      url: 'U',
    });
  });
});
