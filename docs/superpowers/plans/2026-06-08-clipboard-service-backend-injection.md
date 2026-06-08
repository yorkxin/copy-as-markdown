# Clipboard Service Backend Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime API-availability branch in the clipboard service with two peer backends selected at the composition root by `BUILD_TARGET`, mirroring the `MarkdownConverter` pattern, with no behavior change.

**Architecture:** `ClipboardService` becomes a pure interface with two peer factories — `createNavigatorClipboardService` (Firefox) and `createOffscreenClipboardService` (Chrome, already exists). `src/background.ts` picks one by `BUILD_TARGET` and injects it into a slimmed `createBrowserClipboardServiceController`, which owns only the runtime mock toggle, persistence, and the single empty-text rule. The mock recorder methods move to a segregated `MockClipboardService` type.

**Tech Stack:** TypeScript, esbuild (`BUILD_TARGET` define + DCE), Vitest (unit + browser projects), Playwright (Chrome e2e), `webextension-polyfill` (`browser.*`).

**Design spec:** `docs/superpowers/specs/2026-06-08-clipboard-service-interface-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/services/clipboard-service.ts` | `ClipboardService` interface, `MockClipboardService` interface + factory, navigator backend factory, controller | Modify (add navigator backend, segregate mock type, slim controller, remove two old factories) |
| `src/services/offscreen-clipboard-service.ts` | Chrome offscreen backend | Modify (return `ClipboardService`, drop standalone interface) |
| `src/background.ts` | Composition root — select + inject backend | Modify (`BUILD_TARGET` selection, inject one real service) |
| `test/services/clipboard-service.test.ts` | Unit tests for backends + controller + mock | Rewrite |
| `test/services/offscreen-clipboard-service.test.ts` | Unit tests for offscreen backend | **Unchanged** (only imports the factory; stays green) |
| `test/e2e/helpers.ts` | E2E mock hooks | **Unchanged** (accesses `ClipboardMockCall` type + untyped `__mockClipboardService` global) |

**Key constraint:** the controller signature change ripples through typecheck, so the cut-over (Task 2) is a single atomic commit. Task 1 is purely additive.

---

## Task 1: Add the navigator (Firefox) backend

**Files:**
- Modify: `src/services/clipboard-service.ts`
- Test: `test/services/clipboard-service.test.ts`

This task is additive — the old `createClipboardService` / `createBrowserClipboardService` stay in place, so everything else remains green.

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `test/services/clipboard-service.test.ts` (keep the existing imports/tests for now). Add `createNavigatorClipboardService` to the existing import from `../../src/services/clipboard-service.js`:

```ts
describe('createNavigatorClipboardService', () => {
  it('writes via clipboardAPI and resolves true', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
    const service = createNavigatorClipboardService({ writeText });

    await expect(service.copy('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith('hello');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- clipboard-service`
Expected: FAIL — `createNavigatorClipboardService is not a function` (or an import/type error).

- [ ] **Step 3: Add the navigator backend factory**

In `src/services/clipboard-service.ts`, add this exported function (place it just above `export function createMockClipboardService`). `ClipboardAPI` is already imported at the top of the file:

```ts
/**
 * Firefox backend: write directly with navigator.clipboard from the background.
 * A pure peer implementation — no runtime API-availability checks, no empty-text
 * rule (that policy lives in the controller).
 */
export function createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService {
  return {
    copy: async (text: string): Promise<boolean> => {
      await clipboardAPI.writeText(text);
      return true;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- clipboard-service`
Expected: PASS (the new test plus all pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/clipboard-service.ts test/services/clipboard-service.test.ts
git commit -m "feat: add createNavigatorClipboardService peer backend"
```

---

## Task 2: Cut over to injected backend + slim controller (atomic)

**Files:**
- Modify: `src/services/offscreen-clipboard-service.ts`
- Modify: `src/services/clipboard-service.ts`
- Modify: `src/background.ts`
- Test: `test/services/clipboard-service.test.ts` (rewrite)

This is one commit because the controller signature change breaks typecheck until every caller is updated. Write the new tests first, then make them pass.

- [ ] **Step 1: Rewrite the unit test file to the target shape**

Replace the **entire** contents of `test/services/clipboard-service.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createNavigatorClipboardService,
  createMockClipboardService,
  createBrowserClipboardServiceController,
} from '../../src/services/clipboard-service.js';
import type { ClipboardService } from '../../src/services/clipboard-service.js';

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

function makeRealService(): ClipboardService & { copy: ReturnType<typeof vi.fn> } {
  return { copy: vi.fn(async () => true) } as any;
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
  it('writes via clipboardAPI and resolves true', async () => {
    const writeText = vi.fn<(t: string) => Promise<void>>(async () => {});
    const service = createNavigatorClipboardService({ writeText });

    await expect(service.copy('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith('hello');
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

  it('delegates non-empty copies to the injected real backend', async () => {
    const real = makeRealService();
    const controller = createBrowserClipboardServiceController(real, {
      storageArea: makeStorageArea(),
    });

    await expect(controller.copy('hi', tab)).resolves.toBe(true);
    expect(real.copy).toHaveBeenCalledExactlyOnceWith('hi', tab);
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

    await controller.copy('mocked', tab);
    expect(real.copy).not.toHaveBeenCalled();
    expect(sessionSet).toHaveBeenCalled();

    await controller.setMockMode(false);
    expect(controller.isMockMode()).toBe(false);
    expect((globalThis as any).__mockClipboardService).toBeUndefined();

    await controller.copy('real', tab);
    expect(real.copy).toHaveBeenCalledExactlyOnceWith('real', tab);
  });
});

describe('createMockClipboardService', () => {
  it('records non-empty copies', async () => {
    const sessionSet = installBrowserStorage();
    const service = createMockClipboardService();

    await expect(service.copy('test text')).resolves.toBe(true);
    expect(sessionSet).toHaveBeenCalledExactlyOnceWith({
      mockClipboardCalls: [expect.objectContaining({ text: 'test text' })],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- clipboard-service`
Expected: FAIL — `createBrowserClipboardServiceController` still expects the old `(clipboardAPI, offscreenDocumentService, options)` signature, so `makeRealService()` is rejected (type error) and/or the mock-toggle test fails.

- [ ] **Step 3: Align the offscreen backend to the interface**

Replace the **entire** contents of `src/services/offscreen-clipboard-service.ts` with:

```ts
import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { ClipboardService } from './clipboard-service.js';
import type { OffscreenClipboardResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../contracts/offscreen-messages.js';

/**
 * Chrome backend: write via the shared offscreen document. A peer implementation
 * of ClipboardService (it ignores the optional `tab` argument).
 */
export function createOffscreenClipboardService(
  documentService: OffscreenDocumentService,
): ClipboardService {
  async function copy(text: string): Promise<boolean> {
    const response = await documentService.sendMessage<OffscreenClipboardResponse | undefined>({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      text,
    });
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
    return true;
  }

  return { copy };
}
```

(The standalone `OffscreenClipboardService` interface is removed; `copy(text)` remains assignable to `ClipboardService.copy(text, tab?)`.)

- [ ] **Step 4: Rewrite the clipboard service core**

Replace the **entire** contents of `src/services/clipboard-service.ts` with:

```ts
import type { ClipboardAPI } from './shared-types.js';

export interface ClipboardMockCall {
  text: string;
  tab?: browser.tabs.Tab;
  timestamp: number;
}

export interface ClipboardService {
  /**
   * Copy text to clipboard.
   * If tab is not provided, will attempt to get the current active tab.
   * @returns `true` if the clipboard was updated, `false` for a no-op.
   */
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<boolean>;
}

/**
 * The mock backend additionally exposes recorder methods used by E2E tests.
 * Segregated from the base interface so real backends don't carry these optionals.
 */
export interface MockClipboardService extends ClipboardService {
  getCalls: () => Promise<ClipboardMockCall[]>;
  reset: () => Promise<void>;
  getLastCall: () => Promise<ClipboardMockCall | undefined>;
}

/**
 * Firefox backend: write directly with navigator.clipboard from the background.
 * A pure peer implementation — no runtime API-availability checks, no empty-text
 * rule (that policy lives in the controller).
 */
export function createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService {
  return {
    copy: async (text: string): Promise<boolean> => {
      await clipboardAPI.writeText(text);
      return true;
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

  async function saveCallsToStorage(calls: ClipboardMockCall[]): Promise<boolean> {
    try {
      if (browser.storage?.session) {
        await browser.storage.session.set({ [STORAGE_KEY]: calls });
      } else {
        await browser.storage.local.set({ [STORAGE_KEY]: calls });
      }
      return true;
    } catch (error) {
      console.error('Failed to save mock clipboard calls:', error);
      return false;
    }
  }

  return {
    copy: async (text: string, tab?: browser.tabs.Tab): Promise<boolean> => {
      const calls = await getCallsFromStorage();
      calls.push({ text, tab, timestamp: Date.now() });
      return await saveCallsToStorage(calls);
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

export interface ClipboardServiceController extends ClipboardService {
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
 * of that preference, the E2E globals, and the single empty-text rule.
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
    copy: async (text: string, tab?: browser.tabs.Tab): Promise<boolean> => {
      if (text === '') {
        return false;
      }
      return await activeService().copy(text, tab);
    },
    setMockMode,
    initializeMockState,
    isMockMode: () => mockMode,
  };
}
```

Note what changed versus the old file: `createClipboardService` and `createBrowserClipboardService` are gone; the `OffscreenClipboardService`/`OffscreenDocumentService` imports are gone; the base interface no longer carries the optional recorder methods; the empty-text rule now lives once, in the controller's `copy`.

- [ ] **Step 5: Wire the composition root**

In `src/background.ts`, update the clipboard import line (currently line 10):

```ts
import {
  createBrowserClipboardServiceController,
  createNavigatorClipboardService,
} from './services/clipboard-service.js';
import type { ClipboardService } from './services/clipboard-service.js';
import { createOffscreenClipboardService } from './services/offscreen-clipboard-service.js';
```

Then replace the current controller construction (the `const clipboardService = createBrowserClipboardServiceController(...)` block, currently around lines 48-51) with:

```ts
const realClipboard: ClipboardService = BUILD_TARGET === 'firefox-mv3'
  ? createNavigatorClipboardService(navigator.clipboard)
  : createOffscreenClipboardService(offscreenDocumentService!);

const clipboardService = createBrowserClipboardServiceController(realClipboard);
```

Leave the `offscreenDocumentService` declaration (lines 44-46), the `setMockClipboardMode` global assignment, the `initializeMockState()` call, and every `clipboardService.copy(...)` call site unchanged.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no references to the removed `createClipboardService` / `createBrowserClipboardService` / `OffscreenClipboardService` remain).

- [ ] **Step 7: Run the unit + browser test projects**

Run: `npm run test:unit -- clipboard-service offscreen-clipboard-service`
Expected: PASS — new controller/backend/mock tests pass; `offscreen-clipboard-service.test.ts` still green unchanged.

Then run the full unit + browser suites:

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: PASS (no unused imports left behind).

- [ ] **Step 9: Commit**

```bash
git add src/services/clipboard-service.ts src/services/offscreen-clipboard-service.ts src/background.ts test/services/clipboard-service.test.ts
git commit -m "refactor: inject BUILD_TARGET-chosen clipboard backend; slim controller

Remove the runtime if/else/throw backend selection (createClipboardService,
createBrowserClipboardService). background.ts picks the real backend by
BUILD_TARGET and injects it. Controller owns only the mock toggle, persistence,
and the single empty-text rule. Mock recorder methods segregated onto
MockClipboardService."
```

---

## Task 3: Verify end-to-end and write the PR note

**Files:** none (verification + docs)

- [ ] **Step 1: Build both targets**

Run: `npm run build`
Expected: PASS — `build-chrome` (includes `assert-no-turndown.js`) and `build-firefox-mv3` both succeed.

- [ ] **Step 2: Manually confirm per-target DCE of the unused backend**

Run: `grep -c "writeText" chrome/dist/background.js; grep -c "OFFSCREEN_CLIPBOARD_TARGET\|chrome.offscreen\|createDocument" firefox-mv3/dist/background.js`

Expected:
- The Chrome background bundle should NOT contain the navigator `clipboard.writeText` write path from `createNavigatorClipboardService` (that branch is DCE'd; `BUILD_TARGET === 'firefox-mv3'` is `false` in the Chrome build). Confirm by inspecting matches — there must be no `createNavigatorClipboardService` body / `clipboardAPI.writeText` call.
- The Firefox background bundle should NOT contain the offscreen clipboard send path (`OFFSCREEN_CLIPBOARD_TARGET`) or `chrome.offscreen` document creation for clipboard.

If either path leaks, stop and investigate the `BUILD_TARGET` branch in `src/background.ts` before proceeding.

- [ ] **Step 3: Run the Chrome e2e suite**

Run: `npm run test:e2e`
Expected: PASS. The mock-clipboard path (`__mockClipboardService`, `setMockClipboardMode`, `set-mock-clipboard` / `check-mock-clipboard`) and the real offscreen write path both exercise unchanged.
Note: the parallel-clipboard e2e test is known-flaky — if it trips, re-run it in isolation before treating it as a real failure.

- [ ] **Step 4: Write a short PR note**

Create `docs/superpowers/plans/2026-06-08-clipboard-service-backend-injection-pr-note.md` summarizing the new shape:

```markdown
# PR note: inject the chosen clipboard backend

## What changed
- `ClipboardService` is now a pure interface with two peer backends:
  - `createNavigatorClipboardService(clipboardAPI)` (Firefox)
  - `createOffscreenClipboardService(documentService)` (Chrome)
- `src/background.ts` selects the backend by `BUILD_TARGET` and injects it — the
  runtime `if (clipboardAPI) … else if (offscreenService) … else throw` is gone.
- `createBrowserClipboardServiceController(realService)` owns only the runtime mock
  toggle, persistence, the E2E globals, and the single empty-text rule.
- Removed `createClipboardService` and `createBrowserClipboardService`.
- Mock recorder methods (`getCalls`/`reset`/`getLastCall`) moved off the base
  interface onto `MockClipboardService`.

## Why
Brings the clipboard service in line with `MarkdownConverter`: an interface whose
concrete implementation is chosen at the composition root, with no runtime
API-availability checks. Per-target bundles now carry only their own backend.

## Behavior
Identical. E2E mock hooks unchanged. typecheck / lint / unit+browser / Chrome e2e green.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-08-clipboard-service-backend-injection-pr-note.md
git commit -m "docs: PR note for clipboard backend injection"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** navigator backend (Task 1 + Task 2 Step 4); offscreen returns `ClipboardService` (Task 2 Step 3); controller injection + empty-text centralization + `MockClipboardService` split (Task 2 Step 4); `BUILD_TARGET` root selection (Task 2 Step 5); removed `createClipboardService`/`createBrowserClipboardService` (Task 2 Step 4); tests (Task 2 Step 1); per-target DCE verification (Task 3 Step 2); E2E hooks preserved (Task 2 Step 4 keeps `__mockClipboardService`/`setMockClipboardMode`; Task 3 Step 3 verifies).
- **Type consistency:** factory names are stable across tasks — `createNavigatorClipboardService`, `createOffscreenClipboardService`, `createMockClipboardService`, `createBrowserClipboardServiceController`; interfaces `ClipboardService`, `MockClipboardService`, `ClipboardServiceController`, `ClipboardMockCall`. `ClipboardMockCall` stays exported (imported by `test/e2e/helpers.ts`).
- **No new infra:** no build-assertion script is added (Task 3 Step 2 is a one-time manual grep), per the design decision.
```
