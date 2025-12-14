import { describe, expect, it, vi } from 'vitest';
import { BrowserTabDataFetcher } from '../../src/services/browser-tab-data-fetcher.js';

describe('browserTabDataFetcher', () => {
  it('requests tabs permission and opens permission window when missing', async () => {
    const permissionsContains = vi.fn(async () => false);
    const windowsCreate = vi.fn(async () => undefined);
    const tabsQuery = vi.fn();
    const runtimeGetURL = vi.fn(() => '/dist/static/permissions.html?permissions=tabs');

    const fetcher = new BrowserTabDataFetcher({
      permissions: { contains: permissionsContains },
      tabs: { query: tabsQuery },
      windows: { create: windowsCreate },
      runtime: { getURL: runtimeGetURL },
    });

    await expect(fetcher.fetchTabs('all', 1)).rejects.toThrow(/Tabs permission required/);
    expect(permissionsContains).toHaveBeenCalledWith({ permissions: ['tabs'] });
    expect(windowsCreate).toHaveBeenCalledTimes(1);
    expect(tabsQuery).not.toHaveBeenCalled();
  });

  it('queries tab groups when permission is granted', async () => {
    const permissionsContains = vi.fn(async (opts: any) => {
      expect(opts.permissions).toContain('tabGroups');
      return true;
    });
    const tabGroupsQuery = vi.fn(async () => [{ id: 1 } as chrome.tabGroups.TabGroup]);

    const fetcher = new BrowserTabDataFetcher({
      permissions: { contains: permissionsContains },
      tabs: { query: vi.fn() },
      windows: { create: vi.fn() },
      runtime: { getURL: vi.fn() },
      tabGroups: () => ({ query: tabGroupsQuery }),
    });

    const result = await fetcher.fetchTabGroups(5);
    expect(result).toEqual([{ id: 1 }]);
    expect(tabGroupsQuery).toHaveBeenCalledWith({ windowId: 5 });
  });

  it('re-checks tabGroups API availability on each call', async () => {
    const permissionsContains = vi.fn(async () => true);
    const tabGroupsQuery = vi.fn(async () => [{ id: 2 } as chrome.tabGroups.TabGroup]);
    const tabGroupsProvider = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValue({ query: tabGroupsQuery });

    const fetcher = new BrowserTabDataFetcher({
      permissions: { contains: permissionsContains },
      tabs: { query: vi.fn() },
      windows: { create: vi.fn() },
      runtime: { getURL: vi.fn() },
      tabGroups: tabGroupsProvider,
    });

    const firstResult = await fetcher.fetchTabGroups(3);
    expect(firstResult).toEqual([]);
    expect(tabGroupsProvider).toHaveBeenCalledTimes(1);
    expect(permissionsContains).not.toHaveBeenCalled();

    const secondResult = await fetcher.fetchTabGroups(3);
    expect(secondResult).toEqual([{ id: 2 }]);
    expect(tabGroupsProvider).toHaveBeenCalledTimes(2);
    expect(permissionsContains).toHaveBeenCalledTimes(1);
    expect(tabGroupsQuery).toHaveBeenCalledWith({ windowId: 3 });
  });
});
