import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const multipleLinksSettingsMock = {
  keys: ['multipleLinks.markdown.bulletListMarker', 'multipleLinks.markdown.tabGroupIndentation'],
  getAll: vi.fn(),
  setBulletListMarker: vi.fn(),
  setTabGroupIndentation: vi.fn(),
};

const ensureMarkdownSettingsMigratedMock = vi.fn();
const resetMultipleLinksSettingsMock = vi.fn();
const loadPermissionsMock = vi.fn();

const PermissionStatusValue = {
  Yes: 'yes',
  No: 'no',
  Unavailable: 'unavailable',
} as const;

vi.mock('../../src/lib/multiple-links-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/multiple-links-settings.js')>();
  return {
    ...actual,
    default: multipleLinksSettingsMock,
  };
});

vi.mock('../../src/lib/markdown-settings.js', () => ({
  ensureMarkdownSettingsMigrated: ensureMarkdownSettingsMigratedMock,
  resetMultipleLinksSettings: resetMultipleLinksSettingsMock,
}));

vi.mock('../../src/ui/permissions-ui.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/permissions-ui.js')>();
  return {
    ...actual,
    loadPermissions: loadPermissionsMock,
  };
});

async function loadPage(): Promise<void> {
  const response = await fetch('/src/static/multiple-links.html');
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;
}

function mockBrowser(): void {
  (globalThis as any).browser = {
    storage: { sync: { onChanged: { addListener: vi.fn() } } },
  };
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function startPage(): Promise<void> {
  await import('../../src/ui/multiple-links.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
}

describe('multiple links options page', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockBrowser();
    ensureMarkdownSettingsMigratedMock.mockResolvedValue(undefined);
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.Yes]]));
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', tabGroupIndentation: 'spaces' });
    multipleLinksSettingsMock.setBulletListMarker.mockResolvedValue(undefined);
    multipleLinksSettingsMock.setTabGroupIndentation.mockResolvedValue(undefined);
    resetMultipleLinksSettingsMock.mockResolvedValue(undefined);
    await loadPage();
  });

  it('owns only the Multiple Links controls', async () => {
    await startPage();

    await expect.element(page.getByRole('heading', { name: /Multiple Links/ })).toBeVisible();
    expect(document.querySelector('#form-multiple-links-bullet-list-marker')).not.toBeNull();
    expect(document.querySelector('#form-multiple-links-tab-group-indentation')).not.toBeNull();
    // Code-block style belongs to Copy Selection, escaping to Advanced, and
    // command visibility to Menu Commands.
    expect(document.querySelector('[name="code-block-style"]')).toBeNull();
    expect(document.querySelector('#form-link-text-always-escape-brackets')).toBeNull();
    expect(document.querySelector('[data-built-in-style]')).toBeNull();
  });

  it('keeps its custom format child links', async () => {
    await startPage();

    const slots = document.querySelectorAll('[data-menu-custom-format-context="multiple-links"] [data-menu-custom-format-slot]');
    expect(slots).toHaveLength(5);
  });

  it('migrates a legacy profile before its first read', async () => {
    const order: string[] = [];
    ensureMarkdownSettingsMigratedMock.mockImplementation(async () => {
      order.push('migrate');
    });
    multipleLinksSettingsMock.getAll.mockImplementation(async () => {
      order.push('read');
      return { bulletListMarker: '*', tabGroupIndentation: 'spaces' };
    });

    await startPage();

    expect(order[0]).toBe('migrate');
    expect(order).toContain('read');
  });

  it('loads the persisted settings into the controls', async () => {
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', tabGroupIndentation: 'tab' });

    await startPage();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: /^Tab$/ })).toBeChecked();
  });

  it('saves the bullet list marker to the Multiple Links context only', async () => {
    await startPage();

    await page.getByRole('radio', { name: /Plus Signs/ }).click();
    await vi.waitFor(() => expect(multipleLinksSettingsMock.setBulletListMarker).toHaveBeenCalledWith('+'));
    await expect.element(page.getByTestId('flash-error')).not.toBeVisible();
  });

  it('saves the tab group indentation', async () => {
    await startPage();

    await page.getByRole('radio', { name: /^Tab$/ }).click();
    await vi.waitFor(() => expect(multipleLinksSettingsMock.setTabGroupIndentation).toHaveBeenCalledWith('tab'));
  });

  it('shows the persisted value and flashes when a save fails', async () => {
    await startPage();
    multipleLinksSettingsMock.setBulletListMarker.mockRejectedValueOnce(new Error('fail'));
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', tabGroupIndentation: 'spaces' });

    await page.getByRole('radio', { name: /Plus Signs/ }).click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('resets only the Multiple Links context', async () => {
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', tabGroupIndentation: 'tab' });
    await startPage();
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', tabGroupIndentation: 'spaces' });

    await page.getByTestId('reset-multiple-links').click();
    await vi.waitFor(() => expect(resetMultipleLinksSettingsMock).toHaveBeenCalledTimes(1));
    await expect.element(page.getByRole('radio', { name: /Dashes/ })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: /^Spaces$/ })).toBeChecked();
  });

  it('flashes and shows the persisted values when a reset fails', async () => {
    multipleLinksSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', tabGroupIndentation: 'tab' });
    await startPage();
    resetMultipleLinksSettingsMock.mockRejectedValueOnce(new Error('fail'));

    await page.getByTestId('reset-multiple-links').click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('disables the tab group indentation controls without the tabGroups permission', async () => {
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.No]]));

    await startPage();
    await flush();

    await expect.element(page.getByRole('radio', { name: /^Spaces$/ })).toBeDisabled();
    await expect.element(page.getByRole('radio', { name: /^Tab$/ })).toBeDisabled();
    await expect.element(page.getByTestId('requires-permissions-tab-groups')).not.toHaveClass('is-hidden');
  });

  it('enables the tab group indentation controls when the permission is granted', async () => {
    await startPage();
    await flush();

    await expect.element(page.getByRole('radio', { name: /^Spaces$/ })).toBeEnabled();
    await expect.element(page.getByTestId('requires-permissions-tab-groups')).toHaveClass('is-hidden');
  });
});
