import { describe, expect, it, vi } from 'vitest';
import { createRuntimeMessageHandler } from '../../src/handlers/runtime-message-handler.js';
import type { TabsAPI } from '../../src/services/shared-types.js';
import type { LinkExportService } from '../../src/services/link-export-service.js';
import type { TabExportService } from '../../src/services/tab-export-service.js';

type Services = {
  linkExportService: LinkExportService;
  tabExportService: TabExportService;
};

function createServices(overrides?: Partial<Services>): Services {
  return {
    linkExportService: {
      exportLink: vi.fn().mockRejectedValue(new Error('linkExportService should not be called')),
    },
    tabExportService: {
      exportTabs: vi.fn().mockRejectedValue(new Error('tabExportService should not be called')),
    },
    ...overrides,
  } as Services;
}

describe('runtimeMessageHandler', () => {
  it('exports current tab', async () => {
    const tabsAPI: TabsAPI = {
      get: vi.fn(async () => ({ title: 'T', url: 'U' } as browser.tabs.Tab)),
    };
    const exportLinkMock = vi.fn(async () => 'link');

    const handler = createRuntimeMessageHandler(
      createServices({ linkExportService: { exportLink: exportLinkMock } }),
      tabsAPI,
    );

    const result = await handler.handleMessage('export-current-tab', { tabId: 1, format: 'link' });
    expect(result).toBe('link');
    expect(exportLinkMock).toHaveBeenCalledWith({
      format: 'link',
      customFormatSlot: undefined,
      title: 'T',
      url: 'U',
    });
  });

  it('exports tabs', async () => {
    const exportTabsMock = vi.fn(async () => 'tabs');
    const handler = createRuntimeMessageHandler(
      createServices({ tabExportService: { exportTabs: exportTabsMock } }),
      { get: vi.fn() },
    );

    const params = { scope: 'all', format: 'link', listType: 'list', windowId: 2 };
    const result = await handler.handleMessage('export-tabs', params);
    expect(result).toBe('tabs');
    expect(exportTabsMock).toHaveBeenCalledWith(params);
  });

  it('throws on undefined tab', async () => {
    const handler = createRuntimeMessageHandler(
      createServices(),
      { get: vi.fn(async () => undefined as any) },
    );

    await expect(handler.handleMessage('export-current-tab', { tabId: 1, format: 'link' }))
      .rejects.toThrow(/got undefined tab/);
  });

  it('throws on unknown topic', async () => {
    const handler = createRuntimeMessageHandler(createServices(), { get: vi.fn() });
    await expect(handler.handleMessage('nope', {})).rejects.toThrow(/Unknown message topic/);
  });
});
