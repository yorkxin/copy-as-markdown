import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const settingsMock = {
  getAll: vi.fn(),
  setLinkTextAlwaysEscapeBrackets: vi.fn(),
  reset: vi.fn(),
  keys: ['linkTextAlwaysEscapeBrackets'],
};

vi.mock('../../src/lib/settings.js', () => ({
  __esModule: true,
  default: settingsMock,
}));

async function loadPage(): Promise<void> {
  const response = await fetch('/src/static/advanced.html');
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
  await import('../../src/ui/advanced.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
}

describe('advanced UI', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockBrowser();
    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: false });
    settingsMock.setLinkTextAlwaysEscapeBrackets.mockResolvedValue(undefined);
    settingsMock.reset.mockResolvedValue(undefined);
    await loadPage();
  });

  it('loads the persisted preference into the checkbox', async () => {
    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: true });

    await startPage();

    const checkbox = page.getByRole('checkbox', { name: /Always escape brackets/ });
    await expect.element(checkbox).toBeChecked();
  });

  it('saves the preference as soon as the checkbox changes', async () => {
    await startPage();

    const checkbox = page.getByRole('checkbox', { name: /Always escape brackets/ });
    await checkbox.click();
    await flush();

    expect(settingsMock.setLinkTextAlwaysEscapeBrackets).toHaveBeenCalledWith(true);
    await expect.element(page.getByTestId('flash-error')).not.toBeVisible();
  });

  it('restores the checkbox to the persisted value and flashes when a save fails', async () => {
    await startPage();
    settingsMock.setLinkTextAlwaysEscapeBrackets.mockRejectedValueOnce(new Error('fail'));
    // Another page enabled it in the meantime: the failed save must show what is
    // actually persisted, not simply undo the click.
    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: true });

    const checkbox = page.getByRole('checkbox', { name: /Always escape brackets/ });
    await checkbox.click();
    await flush();

    await expect.element(checkbox).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('resets only the link-text escaping preference', async () => {
    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: true });
    await startPage();

    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: false });
    await page.getByTestId('reset-advanced').click();
    await flush();

    expect(settingsMock.reset).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole('checkbox', { name: /Always escape brackets/ })).not.toBeChecked();
  });

  it('flashes and re-reads the persisted value when a reset fails', async () => {
    settingsMock.getAll.mockResolvedValue({ alwaysEscapeLinkBrackets: true });
    await startPage();

    settingsMock.reset.mockRejectedValueOnce(new Error('fail'));
    await page.getByTestId('reset-advanced').click();
    await flush();

    await expect.element(page.getByRole('checkbox', { name: /Always escape brackets/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('shows an error when the initial load fails', async () => {
    settingsMock.getAll.mockRejectedValueOnce(new Error('fail'));

    await startPage();

    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('says the preference does not affect Copy Selection', async () => {
    await startPage();

    expect(document.body.textContent).toContain('does not affect Copy Selection');
  });
});
