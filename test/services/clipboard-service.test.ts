import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserClipboardServiceController,
  createMockClipboardService,
  createNavigatorClipboardService,
} from '../../src/services/clipboard-service.js';
import type { ClipboardService } from '../../src/services/clipboard-service.js';

function makeRealService(): ClipboardService & { copy: ReturnType<typeof vi.fn> } {
  return { copy: vi.fn(async () => {}) } as any;
}

function makeStorageArea(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (obj: Record<string, unknown>) => {
      Object.assign(data, obj);
    }),
  } as any;
}

function installBrowserStorage() {
  const sessionSet = vi.fn(async () => undefined);
  (globalThis as any).browser = {
    storage: {
      session: {
        get: vi.fn(async () => ({ mockClipboardCalls: [] })),
        set: sessionSet,
      },
      local: { get: vi.fn(), set: vi.fn() },
    },
  };
  return sessionSet;
}

describe('createNavigatorClipboardService', () => {
  it('writes via clipboardAPI and resolves void', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
    const service = createNavigatorClipboardService({ writeText });

    await expect(service.copy('hello')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('rejects when clipboardAPI.writeText rejects', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>(async () => {
      throw new Error('denied');
    });
    const service = createNavigatorClipboardService({ writeText });

    await expect(service.copy('hello')).rejects.toThrow('denied');
  });
});

describe('createBrowserClipboardServiceController', () => {
  it('returns false for empty text without touching the real backend', async () => {
    const real = makeRealService();
    const controller = createBrowserClipboardServiceController(real, {
      storageArea: makeStorageArea(),
    });

    await expect(controller.copy('')).resolves.toBe(false);
    expect(real.copy).not.toHaveBeenCalled();
  });

  it('returns true and delegates non-empty copies to the injected real backend', async () => {
    const real = makeRealService();
    const controller = createBrowserClipboardServiceController(real, {
      storageArea: makeStorageArea(),
    });

    await expect(controller.copy('hi')).resolves.toBe(true);
    expect(real.copy).toHaveBeenCalledExactlyOnceWith('hi');
  });

  it('routes copies to the mock in mock mode and toggles the global hook', async () => {
    const sessionSet = installBrowserStorage();
    const real = makeRealService();
    const controller = createBrowserClipboardServiceController(real, {
      storageArea: makeStorageArea(),
    });

    await controller.setMockMode(true);
    expect(controller.isMockMode()).toBe(true);
    expect((globalThis as any).__mockClipboardService).toBeDefined();

    await expect(controller.copy('mocked')).resolves.toBe(true);
    expect(real.copy).not.toHaveBeenCalled();
    expect(sessionSet).toHaveBeenCalled();

    await controller.setMockMode(false);
    expect(controller.isMockMode()).toBe(false);
    expect((globalThis as any).__mockClipboardService).toBeUndefined();

    await controller.copy('real');
    expect(real.copy).toHaveBeenCalledExactlyOnceWith('real');
  });
});

function installStatefulBrowserStorage() {
  let store: unknown[] = [];
  (globalThis as any).browser = {
    storage: {
      session: {
        get: vi.fn(async () => ({ mockClipboardCalls: store })),
        set: vi.fn(async (obj: { mockClipboardCalls: unknown[] }) => {
          store = obj.mockClipboardCalls;
        }),
      },
      local: { get: vi.fn(), set: vi.fn() },
    },
  };
}

describe('createMockClipboardService', () => {
  it('records non-empty copies', async () => {
    const sessionSet = installBrowserStorage();
    const service = createMockClipboardService();

    await expect(service.copy('test text')).resolves.toBeUndefined();
    expect(sessionSet).toHaveBeenCalledExactlyOnceWith({
      mockClipboardCalls: [expect.objectContaining({ text: 'test text' })],
    });
  });

  it('exposes recorded calls via getCalls / getLastCall and clears them via reset', async () => {
    installStatefulBrowserStorage();
    const service = createMockClipboardService();

    await service.copy('first');
    await service.copy('second');

    expect((await service.getCalls()).map(c => c.text)).toEqual(['first', 'second']);
    expect((await service.getLastCall())?.text).toBe('second');

    await service.reset();

    expect(await service.getCalls()).toEqual([]);
    expect(await service.getLastCall()).toBeUndefined();
  });
});
