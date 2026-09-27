import type { ClipboardAPI } from './shared-types.js';

export interface ClipboardMockCall {
  text: string;
  timestamp: number;
}

export interface ClipboardService {
  /** Backends resolve on success and throw on failure; only the controller handles empty text. */
  copy: (text: string) => Promise<void>;
}

export interface MockClipboardService extends ClipboardService {
  getCalls: () => Promise<ClipboardMockCall[]>;
  reset: () => Promise<void>;
  getLastCall: () => Promise<ClipboardMockCall | undefined>;
}

export function createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService {
  return {
    copy: async (text: string): Promise<void> => {
      await clipboardAPI.writeText(text);
    },
  };
}

/** Records writes in extension session storage for E2E inspection across worker restarts. */
export function createMockClipboardService(): MockClipboardService {
  const STORAGE_KEY = 'mockClipboardCalls';

  async function getCallsFromStorage(): Promise<ClipboardMockCall[]> {
    try {
      if (browser.storage?.session) {
        const result = await browser.storage.session.get(STORAGE_KEY);
        return result[STORAGE_KEY] || [];
      }
      const result = await browser.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    } catch {
      return [];
    }
  }

  async function saveCallsToStorage(calls: ClipboardMockCall[]): Promise<void> {
    try {
      if (browser.storage?.session) {
        await browser.storage.session.set({ [STORAGE_KEY]: calls });
      } else {
        await browser.storage.local.set({ [STORAGE_KEY]: calls });
      }
    } catch (error) {
      console.error('Failed to save mock clipboard calls:', error);
    }
  }

  return {
    copy: async (text: string): Promise<void> => {
      const calls = await getCallsFromStorage();
      calls.push({ text, timestamp: Date.now() });
      await saveCallsToStorage(calls);
    },
    getCalls: async () => {
      return await getCallsFromStorage();
    },
    reset: async () => {
      await saveCallsToStorage([]);
    },
    getLastCall: async () => {
      const calls = await getCallsFromStorage();
      return calls[calls.length - 1];
    },
  };
}

export interface ClipboardServiceController {
  /** Returns false only when empty text suppresses the backend write. */
  copy: (text: string) => Promise<boolean>;
  /** Sets mock mode and best-effort persists it in e2e builds; otherwise a no-op. */
  setMockMode: (enabled: boolean) => Promise<void>;
  /** Initializes mock mode from storage in e2e builds; otherwise a no-op. */
  initializeMockState: () => Promise<void>;
  /** Always false outside e2e builds. */
  isMockMode: () => boolean;
}

/**
 * The composition root selects the real backend. This controller switches between
 * it and the persisted E2E mock, and treats empty text as a no-op.
 */
export function createBrowserClipboardServiceController(
  realService: ClipboardService,
  options?: {
    storageArea?: browser.storage.StorageArea;
    storageKey?: string;
    defaultMockState?: boolean;
  },
): ClipboardServiceController {
  const storageKey = options?.storageKey ?? 'mockClipboardEnabled';
  const storageArea = options?.storageArea ?? ((browser.storage as any).session || browser.storage.local);
  const defaultMockState = options?.defaultMockState ?? false;

  let mockMode = defaultMockState;
  let mockService: MockClipboardService | null = null;

  function activeService(): ClipboardService {
    if (BUILD_PROFILE === 'e2e' && mockMode) {
      return (mockService ??= createMockClipboardService());
    }
    return realService;
  }

  function syncGlobalMockService(): void {
    if (BUILD_PROFILE === 'e2e') {
      if (mockMode) {
        (globalThis as any).__mockClipboardService = (mockService ??= createMockClipboardService());
      } else if ((globalThis as any).__mockClipboardService) {
        delete (globalThis as any).__mockClipboardService;
      }
    }
  }

  syncGlobalMockService();

  async function persistMockState(): Promise<void> {
    try {
      await storageArea.set({ [storageKey]: mockMode });
    } catch (error) {
      console.error('Failed to persist mock clipboard state', error);
    }
  }

  async function setMockMode(enabled: boolean): Promise<void> {
    if (BUILD_PROFILE !== 'e2e') return;
    if (mockMode !== enabled) {
      mockMode = enabled;
      syncGlobalMockService();
    }

    await persistMockState();
  }

  async function initializeMockState(): Promise<void> {
    if (BUILD_PROFILE !== 'e2e') return;
    try {
      const stored = await storageArea.get(storageKey);
      const storedValue = stored[storageKey];
      if (typeof storedValue === 'boolean') {
        if (storedValue !== mockMode) {
          await setMockMode(storedValue);
        } else {
          await persistMockState();
        }
        return;
      }

      await storageArea.set({ [storageKey]: defaultMockState });
      if (mockMode !== defaultMockState) {
        await setMockMode(defaultMockState);
      }
    } catch (error) {
      console.error('Failed to initialize mock clipboard state', error);
    }
  }

  return {
    copy: async (text: string): Promise<boolean> => {
      if (text === '') {
        return false;
      }
      await activeService().copy(text);
      return true;
    },
    setMockMode,
    initializeMockState,
    isMockMode: () => (BUILD_PROFILE === 'e2e' ? mockMode : false),
  };
}
