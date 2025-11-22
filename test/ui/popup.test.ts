// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const popupHtml = fs.readFileSync(path.join(process.cwd(), 'src/static/popup.html'), 'utf8');
const listMock = vi.fn();

vi.mock('../../src/storage/custom-formats-storage.js', () => ({
  default: {
    list: listMock,
  },
}));

function resetDom(): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(popupHtml, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

interface BrowserMocks {
  sendMessageMock: ReturnType<typeof vi.fn>;
  clipboardMock: ReturnType<typeof vi.fn>;
}

function mockBrowser(tabs: browser.tabs.Tab[], mockClipboardAvailable = false): BrowserMocks {
  const mockWindow: browser.windows.Window = { id: 42, tabs };
  const sendMessageMock = vi.fn(async (message: any) => {
    if (message.topic === 'check-mock-clipboard') {
      return { ok: true, text: mockClipboardAvailable ? 'true' : 'false' };
    }
    if (message.topic === 'export-current-tab' || message.topic === 'export-tabs') {
      return { ok: true, text: 'copied text' };
    }
    if (message.topic === 'copy-to-clipboard') {
      return { ok: true };
    }
    if (message.topic === 'badge') {
      return { ok: true };
    }
    return { ok: true };
  });

  (globalThis as any).browser = {
    runtime: {
      sendMessage: sendMessageMock,
      openOptionsPage: vi.fn(),
      lastError: undefined,
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue(mockWindow),
      get: vi.fn().mockResolvedValue(mockWindow),
    },
  };

  const clipboardMock = vi.fn().mockResolvedValue(undefined);
  (navigator as any).clipboard = { writeText: clipboardMock };
  vi.spyOn(window, 'close').mockImplementation(() => { });

  return { sendMessageMock, clipboardMock };
}

async function loadPopup(): Promise<void> {
  await import('../../src/ui/popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
}

describe('popup UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    listMock.mockReset();
    resetDom();
  });

  it('renders tab counts from the current window', async () => {
    mockBrowser([
      { id: 1, active: true, highlighted: true } as browser.tabs.Tab,
      { id: 2, active: false, highlighted: false } as browser.tabs.Tab,
      { id: 3, active: false, highlighted: true } as browser.tabs.Tab,
    ]);
    listMock.mockResolvedValue([]);

    await loadPopup();

    expect(document.getElementById('display-count-all-tabs')?.textContent).toBe('3');
    expect(document.getElementById('display-count-highlighted-tabs')?.textContent).toBe('2');
  });

  it('shows custom formats that are flagged to appear in menus', async () => {
    mockBrowser([{ id: 1, active: true, highlighted: true } as browser.tabs.Tab]);
    listMock.mockImplementation(async (context: string) => {
      if (context === 'multiple-links') {
        return [
          { slot: 'alpha', displayName: 'Alpha', showInMenus: true },
          { slot: 'beta', displayName: 'Hidden', showInMenus: false },
        ];
      }
      return [
        { slot: 'gamma', displayName: 'Gamma', showInMenus: true },
      ];
    });

    await loadPopup();

    expect(document.getElementById('all-tabs-custom-format-alpha')?.textContent ?? '').toContain('Alpha');
    expect(document.getElementById('highlighted-tabs-custom-format-alpha')?.textContent ?? '').toContain('Alpha');
    expect(document.getElementById('current-tab-custom-format-gamma')?.textContent ?? '').toContain('Gamma');
    expect(document.querySelector('[id^="all-tabs-custom-format-beta"]')).toBeNull();
  });

  it('sends an export message and copies returned text on submit', async () => {
    const { sendMessageMock, clipboardMock } = mockBrowser([
      { id: 99, active: true, highlighted: true } as browser.tabs.Tab,
    ]);
    listMock.mockResolvedValue([]);

    await loadPopup();

    const button = document.getElementById('current-tab-link') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    await flush();

    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'export-current-tab',
      params: expect.objectContaining({
        tabId: 99,
        format: 'link',
      }),
    }));
    expect(clipboardMock).toHaveBeenCalledWith('copied text');
    expect(window.close).toHaveBeenCalled();
  });
});

it('shows flash on export failure and can be dismissed', async () => {
  const sendMessageMock = vi.fn(async (message: any) => {
    if (message.topic === 'export-current-tab') {
      throw new Error('boom');
    }
    if (message.topic === 'badge') {
      return { ok: true };
    }
    if (message.topic === 'check-mock-clipboard') {
      return { ok: true, text: 'false' };
    }
    return { ok: true };
  });

  (globalThis as any).browser = {
    runtime: {
      sendMessage: sendMessageMock,
      openOptionsPage: vi.fn(),
      lastError: undefined,
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ id: 1, tabs: [{ id: 1, active: true, highlighted: true }] }),
      get: vi.fn(),
    },
  };

  (navigator as any).clipboard = { writeText: vi.fn() };
  vi.spyOn(window, 'close').mockImplementation(() => { });
  listMock.mockResolvedValue([]);

  await import('../../src/ui/popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();

  const button = document.getElementById('current-tab-link') as HTMLButtonElement;
  expect(button).toBeTruthy();
  button.click();
  await flush();

  const flash = document.querySelector('.notification');
  expect(flash?.textContent ?? '').toContain('Failed to copy to clipboard');

  const closeBtn = flash?.querySelector('button.delete') as HTMLButtonElement | null;
  if (closeBtn) {
    closeBtn.click();
    await flush();
  }
  expect(document.querySelector('.notification')).toBeNull();
});

it('does not show flash when tabs permission is missing', async () => {
  const sendMessageMock = vi.fn(async (message: any) => {
    if (message.topic === 'export-current-tab') {
      throw new Error('Tabs permission required');
    }
    if (message.topic === 'badge') {
      return { ok: true };
    }
    if (message.topic === 'check-mock-clipboard') {
      return { ok: true, text: 'false' };
    }
    return { ok: true };
  });

  (globalThis as any).browser = {
    runtime: {
      sendMessage: sendMessageMock,
      openOptionsPage: vi.fn(),
      lastError: undefined,
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ id: 1, tabs: [{ id: 1, active: true, highlighted: true }] }),
      get: vi.fn(),
    },
  };

  (navigator as any).clipboard = { writeText: vi.fn() };
  vi.spyOn(window, 'close').mockImplementation(() => { });
  listMock.mockResolvedValue([]);

  await import('../../src/ui/popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();

  const button = document.getElementById('current-tab-link') as HTMLButtonElement;
  expect(button).toBeTruthy();
  button.click();
  await flush();

  expect(document.querySelector('.notification')).toBeNull();
});
