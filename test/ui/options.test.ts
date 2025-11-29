// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const optionsHtml = fs.readFileSync(path.join(process.cwd(), 'src/static/options.html'), 'utf8');

const settingsMock = {
  getAll: vi.fn(),
  setLinkTextAlwaysEscapeBrackets: vi.fn(),
  setStyleOfUnrderedList: vi.fn(),
  setStyleTabGroupIndentation: vi.fn(),
  reset: vi.fn(),
  keys: [],
};

const loadPermissionsMock = vi.fn();
const PermissionStatusValue = {
  Yes: 'yes',
  No: 'no',
  Unavailable: 'unavailable',
} as const;

vi.mock('../../src/lib/settings.js', () => ({
  __esModule: true,
  default: settingsMock,
}));

vi.mock('../../src/ui/permissions-ui.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/permissions-ui.js')>();
  return {
    __esModule: true,
    ...actual,
    loadPermissions: loadPermissionsMock,
  };
});

function resetDom(): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(optionsHtml, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  (globalThis as any).browser = {
    storage: { sync: { onChanged: { addListener: vi.fn() } } },
  };
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('options UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetDom();
  });

  it('loads settings into the form', async () => {
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: true,
      styleOfUnorderedList: 'asterisk',
      styleOfTabGroupIndentation: 'tab',
    });
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.Yes]]));

    await import('../../src/ui/options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const escapeCheckbox = document.querySelector<HTMLInputElement>('input[name="enabled"]');
    expect(escapeCheckbox?.checked).toBe(true);
    const unordered = document.querySelector<HTMLInputElement>('input[name="character"][value="asterisk"]');
    expect(unordered?.checked).toBe(true);
    const indentation = document.querySelector<HTMLInputElement>('input[name="indentation"][value="tab"]');
    expect(indentation?.checked).toBe(true);
  });

  it('disables tab group indentation when permission not granted', async () => {
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: false,
      styleOfUnorderedList: 'dash',
      styleOfTabGroupIndentation: 'spaces',
    });
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.No]]));

    await import('../../src/ui/options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    document.querySelectorAll<HTMLInputElement>('input[name="indentation"]').forEach((radio) => {
      expect(radio.disabled).toBe(true);
    });
  });

  it('saves settings on change and shows flash on failure', async () => {
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: false,
      styleOfUnorderedList: 'dash',
      styleOfTabGroupIndentation: 'spaces',
    });
    loadPermissionsMock.mockResolvedValue(new Map([['tabGroups', PermissionStatusValue.Yes]]));
    settingsMock.setLinkTextAlwaysEscapeBrackets.mockRejectedValueOnce(new Error('fail'));

    await import('../../src/ui/options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const escapeCheckbox = document.querySelector<HTMLInputElement>('input[name="enabled"]');
    expect(escapeCheckbox).toBeTruthy();
    if (escapeCheckbox) {
      escapeCheckbox.checked = true;
      escapeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      await flush();
    }
    expect(settingsMock.setLinkTextAlwaysEscapeBrackets).toHaveBeenCalled();
    await vi.waitFor(() => {
      const flash = document.querySelector('.notification.is-danger');
      expect(flash).toBeTruthy();
    });
  });

  it('hides or shows permission badges based on permissions', async () => {
    settingsMock.getAll.mockResolvedValue({
      alwaysEscapeLinkBrackets: false,
      styleOfUnorderedList: 'dash',
      styleOfTabGroupIndentation: 'spaces',
    });
    loadPermissionsMock.mockResolvedValue(new Map([
      ['tabGroups', PermissionStatusValue.Yes],
    ]));

    await import('../../src/ui/options.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    const tag = document.querySelector<HTMLElement>('[data-hide-if-permission-contains="tabGroups"]');
    expect(tag?.classList.contains('is-hidden')).toBe(true);
  });
});
