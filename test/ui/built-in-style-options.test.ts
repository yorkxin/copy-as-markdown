// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const optionsHtml = fs.readFileSync(path.join(process.cwd(), 'src/static/multiple-links.html'), 'utf8');

const builtInSettingsMock = {
  getAll: vi.fn(),
  set: vi.fn(),
};

vi.mock('../../src/lib/built-in-style-settings.js', () => ({
  __esModule: true,
  default: builtInSettingsMock,
}));

function resetDom(): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(optionsHtml, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('built-in style options UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetDom();
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

    expect(document.querySelector<HTMLInputElement>('input[data-built-in-style="tabLinkList"]')?.checked).toBe(false);
    expect(document.querySelector<HTMLInputElement>('input[data-built-in-style="tabTaskList"]')?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input[data-built-in-style="tabTitleList"]')?.checked).toBe(false);
    expect(document.querySelector<HTMLInputElement>('input[data-built-in-style="tabUrlList"]')?.checked).toBe(true);
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

    const titleCheckbox = document.querySelector<HTMLInputElement>('input[data-built-in-style="tabTitleList"]');
    expect(titleCheckbox).toBeTruthy();
    if (titleCheckbox) {
      titleCheckbox.checked = false;
      titleCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      await flush();
      expect(builtInSettingsMock.set).toHaveBeenCalledWith('tabTitleList', false);
      expect(titleCheckbox.checked).toBe(true);
    }

    const flash = document.getElementById('flash-error');
    expect(flash?.classList.contains('is-hidden')).toBe(false);
  });
});

