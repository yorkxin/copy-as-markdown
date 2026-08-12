import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const selectionSettingsMock = {
  keys: ['selection.markdown.bulletListMarker', 'selection.markdown.codeBlockStyle'],
  getAll: vi.fn(),
  setBulletListMarker: vi.fn(),
  setCodeBlockStyle: vi.fn(),
};

const ensureMarkdownSettingsMigratedMock = vi.fn();
const resetSelectionSettingsMock = vi.fn();

vi.mock('../../src/lib/selection-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/selection-settings.js')>();
  return {
    ...actual,
    default: selectionSettingsMock,
  };
});

vi.mock('../../src/lib/markdown-settings.js', () => ({
  ensureMarkdownSettingsMigrated: ensureMarkdownSettingsMigratedMock,
  resetSelectionSettings: resetSelectionSettingsMock,
}));

async function loadPage(): Promise<void> {
  const response = await fetch('/src/static/options.html');
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
  await import('../../src/ui/options.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
}

describe('copy selection options page', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockBrowser();
    ensureMarkdownSettingsMigratedMock.mockResolvedValue(undefined);
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', codeBlockStyle: 'fenced' });
    selectionSettingsMock.setBulletListMarker.mockResolvedValue(undefined);
    selectionSettingsMock.setCodeBlockStyle.mockResolvedValue(undefined);
    resetSelectionSettingsMock.mockResolvedValue(undefined);
    await loadPage();
  });

  it('is the landing page for Copy Selection and owns only its own controls', async () => {
    await startPage();

    await expect.element(page.getByRole('heading', { name: /Copy Selection/ })).toBeVisible();
    // Tab group indentation belongs to Multiple Links, escaping to Advanced.
    expect(document.querySelector('#form-multiple-links-tab-group-indentation')).toBeNull();
    expect(document.querySelector('[name="indentation"]')).toBeNull();
    expect(document.querySelector('#form-link-text-always-escape-brackets')).toBeNull();
  });

  it('lists the pages under Formats and Others', async () => {
    await startPage();

    const menu = document.querySelector('#menu')!;
    const labels = [...menu.querySelectorAll('.menu-label')].map(el => el.textContent?.trim());
    expect(labels).toEqual(['Formats', 'Others']);

    const links = [...menu.querySelectorAll('a')]
      .filter(a => !a.dataset.menuCustomFormatSlot)
      .map(a => a.textContent?.trim());
    expect(links).toEqual([
      'Copy Selection',
      'Multiple Links',
      'Single Link',
      'Menu Commands',
      'Advanced',
      'Permissions',
      'Help & Examples',
      'About',
    ]);
  });

  it('migrates a legacy profile before its first read', async () => {
    const order: string[] = [];
    ensureMarkdownSettingsMigratedMock.mockImplementation(async () => {
      order.push('migrate');
    });
    selectionSettingsMock.getAll.mockImplementation(async () => {
      order.push('read');
      return { bulletListMarker: '*', codeBlockStyle: 'fenced' };
    });

    await startPage();

    expect(order[0]).toBe('migrate');
    expect(order).toContain('read');
  });

  it('loads the persisted settings into the controls', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'indented' });

    await startPage();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: /Indented code block/ })).toBeChecked();
  });

  it('saves the bullet list marker to the Copy Selection context only', async () => {
    await startPage();

    await page.getByRole('radio', { name: /Plus Signs/ }).click();
    await vi.waitFor(() => expect(selectionSettingsMock.setBulletListMarker).toHaveBeenCalledWith('+'));
    await expect.element(page.getByTestId('flash-error')).not.toBeVisible();
  });

  it('saves the code block style', async () => {
    await startPage();

    await page.getByRole('radio', { name: /Indented code block/ }).click();
    await vi.waitFor(() => expect(selectionSettingsMock.setCodeBlockStyle).toHaveBeenCalledWith('indented'));
  });

  it('shows the persisted value and flashes when a save fails', async () => {
    await startPage();
    selectionSettingsMock.setBulletListMarker.mockRejectedValueOnce(new Error('fail'));
    // Another page changed it in the meantime: the failed save must show what is
    // actually persisted, not simply undo the click.
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'fenced' });

    await page.getByRole('radio', { name: /Plus Signs/ }).click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('resets only the Copy Selection context', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'indented' });
    await startPage();
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', codeBlockStyle: 'fenced' });

    await page.getByTestId('reset-copy-selection').click();
    await vi.waitFor(() => expect(resetSelectionSettingsMock).toHaveBeenCalledTimes(1));
    await expect.element(page.getByRole('radio', { name: /Dashes/ })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: /Fenced code block/ })).toBeChecked();
  });

  it('flashes and shows the persisted values when a reset fails', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'fenced' });
    await startPage();
    resetSelectionSettingsMock.mockRejectedValueOnce(new Error('fail'));

    await page.getByTestId('reset-copy-selection').click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });
});
