import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';

const builtInSettingsMock = {
  getAll: vi.fn(),
  set: vi.fn(),
};

vi.mock('../../src/lib/built-in-style-settings.js', () => ({
  __esModule: true,
  default: builtInSettingsMock,
}));

async function loadPage(): Promise<void> {
  const response = await fetch('/src/static/multiple-links.html');
  const htmlContent = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('built-in style options UI', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await loadPage();
  });

  it('loads built-in visibility into the checkboxes', async () => {
    builtInSettingsMock.getAll.mockResolvedValue({
      singleLink: true,
      tabLinkList: false,
      tabTaskList: true,
      tabTitleList: false,
      tabUrlList: true,
    });

    await import('../../src/ui/built-in-style-options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    await expect.element(page.getByLabelText('Built-in: Copy tab links as a list')).not.toBeChecked();
    await expect.element(page.getByLabelText('Built-in: Copy tab links as a task list')).toBeChecked();
    await expect.element(page.getByLabelText('Built-in: Copy tab titles')).not.toBeChecked();
    await expect.element(page.getByLabelText('Built-in: Copy tab urls')).toBeChecked();
  });

  it('saves updates and shows flash on failure', async () => {
    builtInSettingsMock.getAll.mockResolvedValue({
      singleLink: true,
      tabLinkList: true,
      tabTaskList: true,
      tabTitleList: true,
      tabUrlList: true,
    });
    builtInSettingsMock.set.mockRejectedValueOnce(new Error('fail'));

    await import('../../src/ui/built-in-style-options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const checkbox = page.getByLabelText('Built-in: Copy tab titles');
    await expect.element(checkbox).toBeChecked();
    await checkbox.click();
    await expect.element(checkbox).toBeChecked();
    expect(builtInSettingsMock.set).toHaveBeenCalledWith('tabTitleList', false);

    const flash = page.getByTestId('flash-error');
    await expect.element(flash).toBeVisible();
  });
});
