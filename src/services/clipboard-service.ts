import type { ClipboardAPI } from './shared-types.js';

export interface ClipboardMockCall {
  text: string;
  timestamp: number;
}

export interface ClipboardService {
  /**
   * Write text to the clipboard, or throw. A backend never reports a soft failure —
   * it either succeeds or raises. The empty-text no-op is the controller's policy.
   */
  copy: (text: string) => Promise<void>;
}

/**
 * The mock backend additionally exposes recorder methods used by E2E tests.
 * Segregated from the base interface so real backends don't carry these members.
 */
export interface MockClipboardService extends ClipboardService {
  getCalls: () => Promise<ClipboardMockCall[]>;
  reset: () => Promise<void>;
  getLastCall: () => Promise<ClipboardMockCall | undefined>;
}

/**
 * Firefox backend: write directly with navigator.clipboard from the background.
 * A pure peer implementation — no runtime API-availability checks, no empty-text rule.
 */
export function createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService {
  return {
    copy: async (text: string): Promise<void> => {
      await clipboardAPI.writeText(text);
    },
  };
}

/**
 * Create a mock clipboard service for testing.
 * Records all copy calls instead of writing to clipboard.
 * Uses chrome.storage.session to persist data across service worker restarts.
 * The empty-text rule is enforced by the controller, not here.
 */
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
  /**
   * Copy text to the clipboard.
   * @returns `true` if a write was delegated to the active backend, `false` for an
   * empty-text no-op.
   */
  copy: (text: string) => Promise<boolean>;

  /**
   * Toggle mock clipboard mode and persist the preference.
   */
  setMockMode: (enabled: boolean) => Promise<void>;

  /**
   * Initialize the controller by restoring the last saved mock mode.
   */
  initializeMockState: () => Promise<void>;

  /**
   * Return whether the controller is currently using the mock clipboard.
   */
  isMockMode: () => boolean;
}

/**
 * Wrap an already-chosen real clipboard backend with the runtime mock toggle.
 *
 * Axis A (which real backend) is decided at the composition root by BUILD_TARGET
 * and injected here. This controller owns ONLY Axis B (mock vs real), persistence
 * of that preference, the E2E globals, and the single empty-text rule. It is also
 * the sole producer of the boolean no-op signal.
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
    if (mockMode) {
      return (mockService ??= createMockClipboardService());
    }
    return realService;
  }

  function syncGlobalMockService(): void {
    if (mockMode) {
      (globalThis as any).__mockClipboardService = (mockService ??= createMockClipboardService());
    } else if ((globalThis as any).__mockClipboardService) {
      delete (globalThis as any).__mockClipboardService;
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
    if (mockMode !== enabled) {
      mockMode = enabled;
      syncGlobalMockService();
    }

    await persistMockState();
  }

  async function initializeMockState(): Promise<void> {
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
    isMockMode: () => mockMode,
  };
}
