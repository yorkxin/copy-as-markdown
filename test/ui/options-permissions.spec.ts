import { page } from '@vitest/browser/context';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const settingsMock = {
  reset: vi.fn(),
};

const loadPermissionsMock = vi.fn();

vi.mock('../../src/lib/settings.js', () => ({
  default: settingsMock,
}));

vi.mock('../../src/ui/permissions-ui.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/permissions-ui.js')>();
  return {
    ...actual,
    loadPermissions: loadPermissionsMock,
  };
});

async function loadOptionsPermissionsHtml(): Promise<void> {
  const response = await fetch('/src/static/options-permissions.html');
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function mockBrowser() {
  const requestMock = vi.fn();
  const removeMock = vi.fn();

  (globalThis as any).browser = {
    permissions: {
      request: requestMock,
      remove: removeMock,
      onAdded: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
    },
  };

  return { requestMock, removeMock };
}

async function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 100));
}

describe('options permissions UI', () => {
  beforeAll(async () => {
    // Set up environment before loading the module
    await loadOptionsPermissionsHtml();

    // Set up initial permission statuses
    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabs', 'yes'],
      ['tabGroups', 'no'],
      ['bookmarks', 'unavailable'],
    ]));

    mockBrowser();

    // Load the options-permissions module - this will register DOM event listeners
    await import('../../src/ui/options-permissions.js');

    // Trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('renders permission buttons according to status', async () => {
    // Tabs granted: request hidden, remove visible
    const tabsGrant = page.getByRole('button', { name: 'Grant Tabs Permission' }); ;
    const tabsRemove = page.getByRole('button', { name: 'Revoke Tabs Permission' }); ;
    await expect.element(tabsGrant).toHaveClass('is-hidden');
    await expect.element(tabsRemove).not.toHaveClass('is-hidden');

    // tabGroups not granted: request visible enabled, remove hidden
    const groupsGrant = page.getByRole('button', { name: 'Grant Tab Groups Permission' }); ;
    const groupsRemove = page.getByRole('button', { name: 'Revoke Tab Groups Permission' }); ;
    await expect.element(groupsGrant).toBeEnabled();
    await expect.element(groupsGrant).not.toHaveClass('is-hidden');
    await expect.element(groupsRemove).toHaveClass('is-hidden');

    // bookmarks unavailable: request disabled
    const bookmarksGrant = page.getByRole('button', { name: 'Grant Bookmarks Permission' }); ;
    await expect.element(bookmarksGrant).not.toBeEnabled();
  });

  it('requests permission on click', async () => {
    const requestMock = (globalThis as any).browser.permissions.request;
    requestMock.mockClear();

    const tabGroupsGrant = page.getByRole('button', { name: /Grant Tab Groups Permission/ });
    await expect.element(tabGroupsGrant).toBeInTheDocument();

    await tabGroupsGrant.click();
    await flush();

    expect(requestMock).toHaveBeenCalledWith({ permissions: ['tabGroups'] });
  });

  it('hides or shows permission badges based on permissions', async () => {
    // Tabs granted: badge should be hidden
    const tabsBadge = page.getByTestId('tabs-not-granted');
    await expect.element(tabsBadge).toHaveClass('is-hidden');

    // Tab Groups not granted: badge should be visible
    const tabGroupsBadge = page.getByTestId('tab-groups-not-granted');
    await expect.element(tabGroupsBadge).not.toHaveClass('is-hidden');

    // Bookmarks unavailable: should show "Unsupported"
    const bookmarksBadge = page.getByTestId('bookmarks-not-granted');
    await expect.element(bookmarksBadge).not.toHaveClass('is-hidden');
    await expect.element(bookmarksBadge).toHaveTextContent('Unsupported');
  });

  it('revokes all permissions via reset button', async () => {
    // Use the existing mocks from the global browser object set up in beforeAll
    const removeMock = (globalThis as any).browser.permissions.remove;

    settingsMock.reset.mockClear();
    removeMock.mockClear();

    const revokeAll = page.getByRole('button', { name: /Revoke All/ });
    await expect.element(revokeAll).toBeInTheDocument();

    await revokeAll.click();
    await flush();

    expect(settingsMock.reset).toHaveBeenCalled();
    // Only tabs is granted in the initial setup, bookmarks is unavailable
    // So only tabs and tabGroups are in the revoke call
    expect(removeMock).toHaveBeenCalledWith({ permissions: ['tabs', 'tabGroups'] });
  });
});
