import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const selectionSettingsMock = {
  keys: ['selection.markdown.bulletListMarker', 'selection.markdown.codeBlockStyle', 'selection.markdown.emDelimiter', 'selection.markdown.strongDelimiter', 'selection.markdown.headingStyle', 'selection.markdown.fence'],
  getAll: vi.fn(),
  setBulletListMarker: vi.fn(),
  setCodeBlockStyle: vi.fn(),
  setEmDelimiter: vi.fn(),
  setStrongDelimiter: vi.fn(),
  setHeadingStyle: vi.fn(),
  setFence: vi.fn(),
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
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' });
    selectionSettingsMock.setBulletListMarker.mockResolvedValue(undefined);
    selectionSettingsMock.setCodeBlockStyle.mockResolvedValue(undefined);
    selectionSettingsMock.setEmDelimiter.mockResolvedValue(undefined);
    selectionSettingsMock.setStrongDelimiter.mockResolvedValue(undefined);
    selectionSettingsMock.setHeadingStyle.mockResolvedValue(undefined);
    selectionSettingsMock.setFence.mockResolvedValue(undefined);
    resetSelectionSettingsMock.mockResolvedValue(undefined);
    await loadPage();
  });

  it('is the landing page for Copy Selection and owns only its own controls', async () => {
    await startPage();

    await expect.element(page.getByRole('heading', { name: /Copy Selection/ })).toBeVisible();
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
      return { bulletListMarker: '*', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' };
    });

    await startPage();

    expect(order[0]).toBe('migrate');
    expect(order).toContain('read');
  });

  it('loads the persisted settings into the controls', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'indented', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' });

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

  it('shows heading and fence examples with the documented Setext limit', async () => {
    await startPage();

    const headings = page.getByRole('group', { name: 'Heading style' });
    const fences = page.getByRole('group', { name: 'Code-fence marker' });
    await expect.element(headings.getByRole('radio', { name: /ATX/ })).toBeChecked();
    await expect.element(fences.getByRole('radio', { name: /Backticks/ })).toBeChecked();
    await expect.element(fences.getByRole('radio', { name: /Tildes/ })).toBeEnabled();
    expect(document.querySelector('#form-selection-heading-style input[value="atx"] + code')?.textContent).toBe('# Heading');
    expect(document.querySelector('#form-selection-heading-style input[value="setext"] + code')?.textContent).toBe('Heading\n=======');
    expect(document.querySelector('#form-selection-heading-style')?.textContent).toContain('H3 through H6 remain ATX');
    expect(document.querySelector('#form-selection-fence')?.textContent).toContain('```js');
    expect(document.querySelector('#form-selection-fence')?.textContent).toContain('~~~js');
  });

  it('keeps the fence visible and selected while indented code blocks disable it', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({
      bulletListMarker: '-',
      codeBlockStyle: 'indented',
      emDelimiter: '_',
      strongDelimiter: '**',
      headingStyle: 'setext',
      fence: '~~~',
    });
    await startPage();

    const tildes = page.getByRole('group', { name: 'Code-fence marker' }).getByRole('radio', { name: /Tildes/ });
    await expect.element(page.getByRole('group', { name: 'Heading style' }).getByRole('radio', { name: /Setext/ })).toBeChecked();
    await expect.element(tildes).toBeChecked();
    await expect.element(tildes).toBeDisabled();

    await page.getByRole('radio', { name: /Fenced code block/ }).click();
    await vi.waitFor(() => expect(selectionSettingsMock.setCodeBlockStyle).toHaveBeenCalledWith('fenced'));
    await expect.element(tildes).toBeChecked();
    await expect.element(tildes).toBeEnabled();
    expect(selectionSettingsMock.setFence).not.toHaveBeenCalled();
  });

  it.each([
    ['Heading style', /Setext/, /ATX/, 'setHeadingStyle', 'setext'],
    ['Code-fence marker', /Tildes/, /Backticks/, 'setFence', '~~~'],
  ] as const)('saves %s immediately and restores the persisted choice on failure', async (group, alternate, initial, setter, value) => {
    await startPage();
    const radios = page.getByRole('group', { name: group });
    await radios.getByRole('radio', { name: alternate }).click();
    await vi.waitFor(() => expect(selectionSettingsMock[setter]).toHaveBeenCalledWith(value));

    selectionSettingsMock[setter].mockRejectedValueOnce(new Error('quota exceeded'));
    selectionSettingsMock.getAll.mockResolvedValue({
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      headingStyle: 'setext',
      fence: '~~~',
    });
    await radios.getByRole('radio', { name: initial }).click();
    await expect.element(radios.getByRole('radio', { name: alternate })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('restores fence availability from storage when code block style save fails', async () => {
    await startPage();
    selectionSettingsMock.setCodeBlockStyle.mockRejectedValueOnce(new Error('quota exceeded'));
    selectionSettingsMock.getAll.mockResolvedValue({
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      headingStyle: 'atx',
      fence: '~~~',
    });

    await page.getByRole('radio', { name: /Indented code block/ }).click();
    const tildes = page.getByRole('group', { name: 'Code-fence marker' }).getByRole('radio', { name: /Tildes/ });
    await expect.element(page.getByRole('radio', { name: /Fenced code block/ })).toBeChecked();
    await expect.element(tildes).toBeChecked();
    await expect.element(tildes).toBeEnabled();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it.each([
    ['Emphasis (italics)', 'Asterisk (*text*)', 'Underscore (_text_)', 'setEmDelimiter', '*'],
    ['Strong emphasis (bold)', 'Double underscores (__text__)', 'Double asterisks (**text**)', 'setStrongDelimiter', '__'],
  ] as const)('saves %s immediately and restores persisted values on failure', async (group, alternate, initial, setter, value) => {
    await startPage();
    const radios = page.getByRole('group', { name: group, exact: true });
    await expect.element(radios.getByRole('radio', { name: initial, exact: true })).toBeChecked();
    await radios.getByRole('radio', { name: alternate, exact: true }).click();
    await vi.waitFor(() => expect(selectionSettingsMock[setter]).toHaveBeenCalledWith(value));
    await expect.element(page.getByTestId('flash-error')).not.toBeVisible();

    // The read after the failed write must win over the user's attempted choice.
    selectionSettingsMock[setter].mockRejectedValueOnce(new Error('quota exceeded'));
    selectionSettingsMock.getAll.mockResolvedValue({
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '__',
      headingStyle: 'atx',
      fence: '```',
    });
    await radios.getByRole('radio', { name: initial, exact: true }).click();
    await expect.element(radios.getByRole('radio', { name: alternate, exact: true })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('shows the persisted value and flashes when a save fails', async () => {
    await startPage();
    selectionSettingsMock.setBulletListMarker.mockRejectedValueOnce(new Error('fail'));
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' });

    await page.getByRole('radio', { name: /Plus Signs/ }).click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });

  it('resets only the Copy Selection context', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'indented', emDelimiter: '*', strongDelimiter: '__', headingStyle: 'setext', fence: '~~~' });
    await startPage();
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' });

    await page.getByTestId('reset-copy-selection').click();
    await vi.waitFor(() => expect(resetSelectionSettingsMock).toHaveBeenCalledTimes(1));
    await expect.element(page.getByRole('radio', { name: /Dashes/ })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: 'Underscore (_text_)', exact: true })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: 'Double asterisks (**text**)', exact: true })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: /Fenced code block/ })).toBeChecked();
    await expect.element(page.getByRole('group', { name: 'Heading style' }).getByRole('radio', { name: /ATX/ })).toBeChecked();
    await expect.element(page.getByRole('group', { name: 'Code-fence marker' }).getByRole('radio', { name: /Backticks/ })).toBeChecked();
  });

  it('flashes and shows the persisted values when a reset fails', async () => {
    selectionSettingsMock.getAll.mockResolvedValue({ bulletListMarker: '*', codeBlockStyle: 'fenced', emDelimiter: '_', strongDelimiter: '**', headingStyle: 'atx', fence: '```' });
    await startPage();
    resetSelectionSettingsMock.mockRejectedValueOnce(new Error('fail'));

    await page.getByTestId('reset-copy-selection').click();
    await flush();

    await expect.element(page.getByRole('radio', { name: /Asterisks/ })).toBeChecked();
    await expect.element(page.getByTestId('flash-error')).toBeVisible();
  });
});
