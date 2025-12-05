import { page } from '@vitest/browser/context';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();

// Mock the storage module before any imports
vi.mock('../../src/storage/custom-formats-storage.js', () => ({
  default: {
    list: listMock,
  },
}));

async function loadPopupHtml(): Promise<void> {
  const response = await fetch('/src/static/popup.html');
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

function mockBrowser(tabs: browser.tabs.Tab[]) {
  const mockWindow: browser.windows.Window = {
    id: 42,
    tabs,
    focused: true,
    incognito: false,
    alwaysOnTop: false,
  };
  const sendMessageMock = vi.fn(async (message: any) => {
    if (message.topic === 'check-mock-clipboard') {
      return { ok: true, text: 'false' };
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
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardMock },
    writable: true,
    configurable: true,
  });

  const closeMock = vi.fn();
  window.close = closeMock;

  return { sendMessageMock, clipboardMock, closeMock };
}

describe('popup UI', () => {
  beforeAll(async () => {
    // Set up environment before loading the module
    await loadPopupHtml();

    mockBrowser([
      { id: 1, active: true, highlighted: true } as browser.tabs.Tab,
      { id: 2, active: false, highlighted: false } as browser.tabs.Tab,
      { id: 3, active: false, highlighted: true } as browser.tabs.Tab,
    ]);

    listMock.mockImplementation(async (context: string) => {
      if (context === 'multiple-links') {
        return [
          { slot: '1', displayName: 'Alpha', showInMenus: true },
          { slot: '2', displayName: 'Hidden', showInMenus: false },
        ];
      }
      return [
        { slot: '1', displayName: 'Gamma', showInMenus: true },
      ];
    });

    // Load the popup module - this will register DOM event listeners
    await import('../../src/ui/popup.js');

    // Trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await (window as any).__popupReady;
  });

  it('renders tab counts from the current window', async () => {
    await expect.element(page.getByTestId('display-count-all-tabs')).toHaveTextContent('3');
    await expect.element(page.getByTestId('display-count-highlighted-tabs')).toHaveTextContent('2');
  });

  it('shows custom formats that are flagged to appear in menus', async () => {
    await expect.element(page.getByText('All Tabs (Alpha)')).toBeVisible();
    await expect.element(page.getByText('Selected Tabs (Alpha)')).toBeVisible();
    await expect.element(page.getByText('Current Tab (Gamma)')).toBeVisible();
    await expect.element(page.getByText('All Tabs (Beta)')).not.toBeInTheDocument();
  });

  it('has working button click handlers', async () => {
    const sendMessageMock = (globalThis as any).browser.runtime.sendMessage;
    const clipboardMock = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    const closeMock = window.close as ReturnType<typeof vi.fn>;

    // Clear previous calls
    sendMessageMock.mockClear();
    clipboardMock.mockClear();
    closeMock.mockClear();

    const button = page.getByText('Current Tab Link');
    await expect.element(button).toBeInTheDocument();
    await button.click();

    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'export-current-tab',
    }));
    expect(clipboardMock).toHaveBeenCalledWith('copied text');
    expect(closeMock).toHaveBeenCalled();
  });
});
