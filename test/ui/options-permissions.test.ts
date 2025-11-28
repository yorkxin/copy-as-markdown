// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.join(process.cwd(), 'src/static/options-permissions.html'), 'utf8');

const settingsMock = {
  reset: vi.fn(),
};

const loadPermissionsMock = vi.fn();

vi.mock('../../src/lib/settings.js', () => ({
  __esModule: true,
  default: settingsMock,
}));

vi.mock('../../src/ui/lib.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/lib.js')>();
  return {
    __esModule: true,
    ...actual,
    loadPermissions: loadPermissionsMock,
  };
});

function resetDom(): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('options permissions UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetDom();
  });

  it('renders permission buttons according to status', async () => {
    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabs', 'yes'],
      ['tabGroups', 'no'],
      ['bookmarks', 'unavailable'],
    ]));
    (globalThis as any).browser = {
      permissions: {
        request: vi.fn(),
        remove: vi.fn(),
        onAdded: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
      },
    };

    await import('../../src/ui/options-permissions.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    // Tabs granted: request hidden, remove visible
    const tabsGrant = document.querySelector<HTMLButtonElement>('[data-request-permission="tabs"]');
    const tabsRemove = document.querySelector<HTMLButtonElement>('[data-remove-permission="tabs"]');
    expect(tabsGrant?.classList.contains('is-hidden')).toBe(true);
    expect(tabsRemove?.classList.contains('is-hidden')).toBe(false);

    // tabGroups not granted: request visible enabled, remove hidden
    const groupGrant = document.querySelector<HTMLButtonElement>('[data-request-permission="tabGroups"]');
    const groupRemove = document.querySelector<HTMLButtonElement>('[data-remove-permission="tabGroups"]');
    expect(groupGrant?.disabled).toBe(false);
    expect(groupGrant?.classList.contains('is-hidden')).toBe(false);
    expect(groupRemove?.classList.contains('is-hidden')).toBe(true);

    // bookmarks unavailable: request disabled and shown
    const bookmarksGrant = document.querySelector<HTMLButtonElement>('[data-request-permission="bookmarks"]');
    expect(bookmarksGrant?.disabled).toBe(true);
  });

  it('requests permission on click', async () => {
    const requestMock = vi.fn();
    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabs', 'no'],
      ['tabGroups', 'no'],
      ['bookmarks', 'no'],
    ]));
    (globalThis as any).browser = {
      permissions: {
        request: requestMock,
        remove: vi.fn(),
        onAdded: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
      },
    };

    await import('../../src/ui/options-permissions.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const tabsGrant = document.querySelector<HTMLButtonElement>('[data-request-permission="tabs"]');
    expect(tabsGrant).toBeTruthy();
    tabsGrant?.click();
    await flush();
    expect(requestMock).toHaveBeenCalledWith({ permissions: ['tabs'] });
  });

  it('revokes all permissions via reset button', async () => {
    const removeMock = vi.fn();
    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabs', 'yes'],
      ['tabGroups', 'no'],
      ['bookmarks', 'yes'],
    ]));
    (globalThis as any).browser = {
      permissions: {
        request: vi.fn(),
        remove: removeMock,
        onAdded: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
      },
    };

    await import('../../src/ui/options-permissions.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const revokeAll = document.getElementById('revoke-all') as HTMLButtonElement;
    expect(revokeAll).toBeTruthy();
    revokeAll.click();
    await flush();

    expect(settingsMock.reset).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith({ permissions: ['tabs', 'tabGroups', 'bookmarks'] });
  });
});
