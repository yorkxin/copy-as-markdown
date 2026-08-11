import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const menuVisibilityMock = {
  getAll: vi.fn(),
  setBuiltIn: vi.fn(),
  setCustomFormat: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../../src/lib/menu-visibility-settings.js', () => ({
  __esModule: true,
  default: menuVisibilityMock,
}));

const AllBuiltInsVisible = {
  singleLink: true,
  tabLinkList: true,
  tabTaskList: true,
  tabTitleList: true,
  tabUrlList: true,
};

interface FakeCustomFormat {
  context: string;
  slot: string;
  showInMenus: boolean;
  displayName: string;
  defaultName: string;
}

function customFormats(
  overrides: Partial<Record<string, Partial<FakeCustomFormat>>> = {},
): FakeCustomFormat[] {
  return ['single-link', 'multiple-links'].flatMap(context =>
    ['1', '2', '3', '4', '5'].map(slot => ({
      context,
      slot,
      showInMenus: false,
      displayName: `Custom Format ${slot}`,
      defaultName: `Custom Format ${slot}`,
      ...overrides[`${context}/${slot}`],
    })),
  );
}

async function loadPage(): Promise<void> {
  const response = await fetch('/src/static/menu-commands.html');
  const htmlContent = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function startPage(): Promise<void> {
  await import('../../src/ui/menu-commands.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
}

describe('menu commands UI', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: AllBuiltInsVisible,
      customFormats: customFormats(),
    });
    await loadPage();
  });

  it('loads built-in visibility into the checkboxes', async () => {
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: { ...AllBuiltInsVisible, tabLinkList: false, tabTitleList: false },
      customFormats: customFormats(),
    });

    await startPage();

    await expect.element(page.getByTestId('builtin-singleLink')).toBeChecked();
    await expect.element(page.getByTestId('builtin-tabLinkList')).not.toBeChecked();
    await expect.element(page.getByTestId('builtin-tabTitleList')).not.toBeChecked();
    await expect.element(page.getByTestId('builtin-tabUrlList')).toBeChecked();
  });

  it('loads custom format visibility into the checkboxes', async () => {
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: AllBuiltInsVisible,
      customFormats: customFormats({ 'single-link/2': { showInMenus: true } }),
    });

    await startPage();

    await expect.element(page.getByTestId('custom-format-single-link-2')).toBeChecked();
    await expect.element(page.getByTestId('custom-format-single-link-1')).not.toBeChecked();
    await expect.element(page.getByTestId('custom-format-multiple-links-2')).not.toBeChecked();
  });

  it('displays user-defined custom format names', async () => {
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: AllBuiltInsVisible,
      customFormats: customFormats({ 'multiple-links/3': { displayName: 'Jira Ticket' } }),
    });

    await startPage();

    await expect.element(page.getByText('Copy as Custom Format 3 (Jira Ticket)')).toBeVisible();
  });

  it('saves a built-in change immediately', async () => {
    await startPage();

    await page.getByTestId('builtin-tabTitleList').click();

    expect(menuVisibilityMock.setBuiltIn).toHaveBeenCalledWith('tabTitleList', false);
  });

  it('saves a custom format change immediately', async () => {
    await startPage();

    await page.getByTestId('custom-format-multiple-links-4').click();

    expect(menuVisibilityMock.setCustomFormat).toHaveBeenCalledWith('multiple-links', '4', true);
  });

  it('restores a built-in checkbox to the persisted value when saving fails', async () => {
    menuVisibilityMock.setBuiltIn.mockRejectedValueOnce(new Error('fail'));

    await startPage();

    const checkbox = page.getByTestId('builtin-tabUrlList');
    await expect.element(checkbox).toBeChecked();
    await checkbox.click();

    await expect.element(checkbox).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('restores a custom format checkbox to the persisted value when saving fails', async () => {
    menuVisibilityMock.setCustomFormat.mockRejectedValueOnce(new Error('fail'));

    await startPage();

    const checkbox = page.getByTestId('custom-format-single-link-5');
    await expect.element(checkbox).not.toBeChecked();
    await checkbox.click();

    await expect.element(checkbox).not.toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('reloads from storage after a successful reset', async () => {
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: { ...AllBuiltInsVisible, tabLinkList: false },
      customFormats: customFormats({ 'single-link/1': { showInMenus: true } }),
    });

    await startPage();

    await expect.element(page.getByTestId('builtin-tabLinkList')).not.toBeChecked();
    await expect.element(page.getByTestId('custom-format-single-link-1')).toBeChecked();

    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: AllBuiltInsVisible,
      customFormats: customFormats(),
    });
    await page.getByTestId('reset-menu-visibility').click();

    expect(menuVisibilityMock.reset).toHaveBeenCalled();
    await expect.element(page.getByTestId('builtin-tabLinkList')).toBeChecked();
    await expect.element(page.getByTestId('custom-format-single-link-1')).not.toBeChecked();
  });

  it('shows the error feedback when reset fails', async () => {
    menuVisibilityMock.reset.mockRejectedValueOnce(new Error('fail'));

    await startPage();

    await page.getByTestId('reset-menu-visibility').click();

    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('shows what a half-finished reset actually persisted', async () => {
    // reset() is two writes; when the second one fails the built-ins are
    // already cleared, so the page must re-read rather than keep its old view.
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: { ...AllBuiltInsVisible, tabLinkList: false },
      customFormats: customFormats({ 'single-link/1': { showInMenus: true } }),
    });

    await startPage();
    await expect.element(page.getByTestId('builtin-tabLinkList')).not.toBeChecked();

    menuVisibilityMock.reset.mockRejectedValueOnce(new Error('fail'));
    menuVisibilityMock.getAll.mockResolvedValue({
      builtIn: AllBuiltInsVisible,
      customFormats: customFormats({ 'single-link/1': { showInMenus: true } }),
    });
    await page.getByTestId('reset-menu-visibility').click();

    await expect.element(page.getByTestId('flash-error')).toBeVisible();
    await expect.element(page.getByTestId('builtin-tabLinkList')).toBeChecked();
    await expect.element(page.getByTestId('custom-format-single-link-1')).toBeChecked();
  });
});
