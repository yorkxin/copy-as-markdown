import { page } from 'vitest/browser';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const loadPermissionsMock = vi.fn();

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
    // Install DOM and browser mocks before import, then dispatch DOMContentLoaded to initialize.
    await loadOptionsPermissionsHtml();

    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabs', 'yes'],
      ['tabGroups', 'no'],
      ['bookmarks', 'unavailable'],
    ]));

    mockBrowser();

    await import('../../src/ui/options-permissions.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
  });

  it('renders permission buttons according to status', async () => {
    const tabsGrant = page.getByRole('button', { name: 'Grant Tabs Permission' }); ;
    const tabsRemove = page.getByRole('button', { name: 'Revoke Tabs Permission' }); ;
    await expect.element(tabsGrant).toHaveClass('is-hidden');
    await expect.element(tabsRemove).not.toHaveClass('is-hidden');

    const groupsGrant = page.getByRole('button', { name: 'Grant Tab Groups Permission' }); ;
    const groupsRemove = page.getByRole('button', { name: 'Revoke Tab Groups Permission' }); ;
    await expect.element(groupsGrant).toBeEnabled();
    await expect.element(groupsGrant).not.toHaveClass('is-hidden');
    await expect.element(groupsRemove).toHaveClass('is-hidden');

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
    const tabsBadge = page.getByTestId('tabs-not-granted');
    await expect.element(tabsBadge).toHaveClass('is-hidden');

    const tabGroupsBadge = page.getByTestId('tab-groups-not-granted');
    await expect.element(tabGroupsBadge).not.toHaveClass('is-hidden');

    const bookmarksBadge = page.getByTestId('bookmarks-not-granted');
    await expect.element(bookmarksBadge).not.toHaveClass('is-hidden');
    await expect.element(bookmarksBadge).toHaveTextContent('Unsupported');
  });

  it('revokes all permissions via reset button, leaving settings alone', async () => {
    const removeMock = (globalThis as any).browser.permissions.remove;

    removeMock.mockClear();

    const revokeAll = page.getByRole('button', { name: /Revoke All/ });
    await expect.element(revokeAll).toBeInTheDocument();

    await revokeAll.click();
    await flush();

    // Unavailable permissions are excluded; granted and requestable permissions are revoked.
    expect(removeMock).toHaveBeenCalledWith({ permissions: ['tabs', 'tabGroups'] });
  });
});
