import { describe, expect, it, vi } from 'vitest';
import { createClipboardService, createMockClipboardService } from '../../src/services/clipboard-service.js';
import type { ClipboardAPI } from '../../src/services/shared-types.js';
import type { OffscreenClipboardService } from '../../src/services/offscreen-clipboard-service.js';

describe('clipboardService', () => {
  describe('copy', () => {
    const tab: browser.tabs.Tab = {
      id: 1,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      mutedInfo: { muted: false },
    };

    function makeOffscreen(ok = true): OffscreenClipboardService & { copy: ReturnType<typeof vi.fn> } {
      return { copy: vi.fn(async () => ok) } as any;
    }

    it('writes via clipboardAPI when provided (Firefox path)', async () => {
      const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
      const clipboardAPI: ClipboardAPI = { writeText };
      const offscreen = makeOffscreen();
      const service = createClipboardService(clipboardAPI, offscreen);

      await expect(service.copy('hello', tab)).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledExactlyOnceWith('hello');
      expect(offscreen.copy).not.toHaveBeenCalled();
    });

    it('delegates to the offscreen service when clipboardAPI is null (Chrome path)', async () => {
      const offscreen = makeOffscreen();
      const service = createClipboardService(null, offscreen);

      await expect(service.copy('hello', tab)).resolves.toBe(true);
      expect(offscreen.copy).toHaveBeenCalledExactlyOnceWith('hello');
    });

    it('returns false for empty text without touching either mechanism', async () => {
      const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
      const offscreen = makeOffscreen();
      const service = createClipboardService({ writeText }, offscreen);

      await expect(service.copy('')).resolves.toBe(false);
      expect(writeText).not.toHaveBeenCalled();
      expect(offscreen.copy).not.toHaveBeenCalled();
    });

    it('throws when no clipboard mechanism is available', async () => {
      const service = createClipboardService(null, null);

      await expect(service.copy('hello')).rejects.toThrow('no clipboard mechanism available');
    });
  });

  describe('mock copy', () => {
    it('records non-empty copies', async () => {
      const sessionGetMock = vi.fn(async () => ({ mockClipboardCalls: [] }));
      const sessionSetMock = vi.fn(async () => undefined);

      (globalThis as any).browser = {
        storage: {
          session: {
            get: sessionGetMock,
            set: sessionSetMock,
          },
          local: {
            get: vi.fn(),
            set: vi.fn(),
          },
        },
      };

      const service = createMockClipboardService();

      await expect(service.copy('test text')).resolves.toBe(true);

      expect(sessionSetMock).toHaveBeenCalledExactlyOnceWith({
        mockClipboardCalls: [
          expect.objectContaining({
            text: 'test text',
          }),
        ],
      });
    });

    it('does not record empty-string copies', async () => {
      const sessionGetMock = vi.fn(async () => ({ mockClipboardCalls: [] }));
      const sessionSetMock = vi.fn(async () => undefined);

      (globalThis as any).browser = {
        storage: {
          session: {
            get: sessionGetMock,
            set: sessionSetMock,
          },
          local: {
            get: vi.fn(),
            set: vi.fn(),
          },
        },
      };

      const service = createMockClipboardService();

      await expect(service.copy('')).resolves.toBe(false);

      expect(sessionGetMock).not.toHaveBeenCalled();
      expect(sessionSetMock).not.toHaveBeenCalled();
    });
  });
});
