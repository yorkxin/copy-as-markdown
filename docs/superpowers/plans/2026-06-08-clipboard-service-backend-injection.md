# Clipboard Service Backend Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime API-availability branch in the clipboard service with two peer backends selected at the composition root by `BUILD_TARGET`, mirroring the `MarkdownConverter` pattern, with no user-visible behavior change.

**Architecture:** `ClipboardService` becomes a pure write-or-throw interface (`copy → Promise<void>`) with two peer factories — `createNavigatorClipboardService` (Firefox) and `createOffscreenClipboardService` (Chrome). `src/background.ts` picks one by `BUILD_TARGET` and injects it into a slimmed `createBrowserClipboardServiceController`, which is the SOLE producer of the `boolean` no-op signal (empty text → `false`) and owns the runtime mock toggle, persistence, and the E2E globals. The mock recorder methods move to a segregated `MockClipboardService` type.

**Tech Stack:** TypeScript, esbuild (`BUILD_TARGET` define + DCE), Vitest (unit + browser projects), Playwright (Chrome e2e), `webextension-polyfill` (`browser.*`).

**Design spec:** `docs/superpowers/specs/2026-06-08-clipboard-service-interface-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/services/clipboard-service.ts` | `ClipboardService` (write-or-throw) + `MockClipboardService` types, navigator backend, mock factory, controller | Rewrite |
| `src/services/offscreen-clipboard-service.ts` | Chrome offscreen backend | Modify (return `Promise<void>`, drop standalone interface) |
| `src/background.ts` | Composition root — select + inject backend | Modify (`BUILD_TARGET` selection, inject one real service) |
| `test/services/clipboard-service.test.ts` | Unit tests for backends + controller + mock | Rewrite |
| `test/services/offscreen-clipboard-service.test.ts` | Unit tests for offscreen backend | Modify (success assertions `toBe(true)` → `toBeUndefined()`) |
| `test/e2e/helpers.ts` | E2E mock hooks | **Unchanged** (imports `ClipboardMockCall` type; accesses the untyped `__mockClipboardService` global) |

**Why one atomic task:** the interface return-type change (`boolean → void`) plus the mock-type segregation ripple through typecheck simultaneously — a `Promise<void>` backend cannot satisfy the old `Promise<boolean>` interface, and removing the base interface's optional recorder methods cannot be separated from introducing `MockClipboardService`. So Task 1 lands as a single commit. Task 2 is verification.

---

## Task 1: Inject the BUILD_TARGET-chosen backend; slim the controller

**Files:**
- Rewrite: `src/services/clipboard-service.ts`
- Modify: `src/services/offscreen-clipboard-service.ts`
- Modify: `src/background.ts`
- Rewrite: `test/services/clipboard-service.test.ts`
- Modify: `test/services/offscreen-clipboard-service.test.ts`

Write the tests first, watch them fail, then implement.

- [ ] **Step 1: Rewrite the clipboard unit test file**

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

    await expect(controller.copy('mocked', tab)).resolves.toBe(true);
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

    await expect(service.copy('test text')).resolves.toBeUndefined();
    expect(sessionSet).toHaveBeenCalledExactlyOnceWith({
      mockClipboardCalls: [expect.objectContaining({ text: 'test text' })],
    });
  });
});
```

- [ ] **Step 2: Update the offscreen backend test assertions**

In `test/services/offscreen-clipboard-service.test.ts`, the success case currently asserts a `true` resolution. Change only that assertion (the two throw-case tests stay as-is). Replace:

```ts
    await expect(clipboard.copy('hello')).resolves.toBe(true);
```

with:

```ts
    await expect(clipboard.copy('hello')).resolves.toBeUndefined();
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:unit -- clipboard-service offscreen-clipboard-service`
Expected: FAIL — `createNavigatorClipboardService` is not exported / the controller still expects the old `(clipboardAPI, offscreenDocumentService, options)` signature, and the offscreen `copy` still resolves `true`.

- [ ] **Step 4: Rewrite the offscreen backend to return void**

Replace the **entire** contents of `src/services/offscreen-clipboard-service.ts` with:

```ts
import type { OffscreenDocumentService } from './offscreen-document-service.js';
import type { ClipboardService } from './clipboard-service.js';
import type { OffscreenClipboardResponse } from '../contracts/offscreen-messages.js';
import { OFFSCREEN_CLIPBOARD_TARGET } from '../contracts/offscreen-messages.js';

/**
 * Chrome backend: write via the shared offscreen document. A peer implementation
 * of ClipboardService — it ignores the optional `tab` argument and resolves on a
 * successful write, otherwise throws.
 */
export function createOffscreenClipboardService(
  documentService: OffscreenDocumentService,
): ClipboardService {
  async function copy(text: string): Promise<void> {
    const response = await documentService.sendMessage<OffscreenClipboardResponse | undefined>({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      text,
    });
    if (!response?.ok) {
      throw new Error(`offscreen clipboard write failed: ${response?.error ?? 'no response'}`);
    }
  }

  return { copy };
}
```

(The standalone `OffscreenClipboardService` interface is removed.)

- [ ] **Step 5: Rewrite the clipboard service core**

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
   * Write text to the clipboard, or throw. A backend never reports a soft failure —
   * it either succeeds or raises. The empty-text no-op is the controller's policy.
   */
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<void>;
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
    copy: async (text: string, tab?: browser.tabs.Tab): Promise<void> => {
      const calls = await getCallsFromStorage();
      calls.push({ text, tab, timestamp: Date.now() });
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
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<boolean>;

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
    copy: async (text: string, tab?: browser.tabs.Tab): Promise<boolean> => {
      if (text === '') {
        return false;
      }
      await activeService().copy(text, tab);
      return true;
    },
    setMockMode,
    initializeMockState,
    isMockMode: () => mockMode,
  };
}
```

What changed versus the old file: `createClipboardService` and `createBrowserClipboardService` are gone; the `OffscreenClipboardService` / `OffscreenDocumentService` imports are gone; the base interface returns `Promise<void>` (no recorder optionals); `MockClipboardService` carries the recorder methods; `ClipboardServiceController` is a standalone interface whose `copy` returns `Promise<boolean>`; the empty-text rule and the boolean live once, in the controller.

- [ ] **Step 6: Wire the composition root**

In `src/background.ts`, replace the clipboard import line (currently line 10):

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

Leave the `offscreenDocumentService` declaration (lines 44-46), the `setMockClipboardMode` global assignment, the `initializeMockState()` call, and every `clipboardService.copy(...)` call site unchanged. (The `didCopy` consumers at lines ~155/174/228 still receive the boolean from the controller.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. No references to the removed `createClipboardService` / `createBrowserClipboardService` / `OffscreenClipboardService` remain; `createNavigatorClipboardService` returning `Promise<void>` satisfies `ClipboardService`.

- [ ] **Step 8: Run the unit + browser suites**

Run: `npm run test:unit -- clipboard-service offscreen-clipboard-service`
Expected: PASS (new controller/backend/mock tests + the updated offscreen assertion).

Then the full suites:

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: PASS (no unused imports left behind).

- [ ] **Step 10: Commit**

```bash
git add src/services/clipboard-service.ts src/services/offscreen-clipboard-service.ts src/background.ts test/services/clipboard-service.test.ts test/services/offscreen-clipboard-service.test.ts
git commit -m "refactor: inject BUILD_TARGET-chosen clipboard backend; slim controller

Remove the runtime if/else/throw backend selection (createClipboardService,
createBrowserClipboardService). background.ts picks the real backend by
BUILD_TARGET and injects it. ClipboardService backends are now pure write-or-throw
(copy -> Promise<void>); the controller is the sole producer of the boolean no-op
signal (empty text -> false) and owns the mock toggle, persistence, and globals.
Mock recorder methods segregated onto MockClipboardService."
```

---

## Task 2: Verify end-to-end and write the PR note

**Files:** Create `docs/superpowers/plans/2026-06-08-clipboard-service-backend-injection-pr-note.md`

- [ ] **Step 1: Build both targets**

Run: `npm run build`
Expected: PASS — `build-chrome` (includes `assert-no-turndown.js`) and `build-firefox-mv3` both succeed.

- [ ] **Step 2: Manually confirm per-target DCE of the unused backend**

Run: `grep -c "writeText" chrome/dist/background.js; grep -c "OFFSCREEN_CLIPBOARD_TARGET\|chrome.offscreen\|createDocument" firefox-mv3/dist/background.js`

Expected:
- The Chrome background bundle must NOT contain the navigator `clipboard.writeText` write path from `createNavigatorClipboardService` (that branch is DCE'd because `BUILD_TARGET === 'firefox-mv3'` is `false` in the Chrome build). Inspect any matches to confirm none is the navigator backend body.
- The Firefox background bundle must NOT contain the offscreen clipboard send path (`OFFSCREEN_CLIPBOARD_TARGET`) or offscreen-document creation for clipboard.

If either path leaks, stop and investigate the `BUILD_TARGET` branch in `src/background.ts` before proceeding.

- [ ] **Step 3: Run the Chrome e2e suite**

Run: `npm run test:e2e`
Expected: PASS. The mock path (`__mockClipboardService`, `setMockClipboardMode`, `set-mock-clipboard` / `check-mock-clipboard`) and the real offscreen write path both exercise unchanged.
Note: the parallel-clipboard e2e test is known-flaky — if it trips, re-run it in isolation before treating it as a real failure.

- [ ] **Step 4: Write a short PR note**

Create `docs/superpowers/plans/2026-06-08-clipboard-service-backend-injection-pr-note.md`:

```markdown
# PR note: inject the chosen clipboard backend

## What changed
- `ClipboardService` is now a pure write-or-throw interface (`copy → Promise<void>`)
  with two peer backends:
  - `createNavigatorClipboardService(clipboardAPI)` (Firefox)
  - `createOffscreenClipboardService(documentService)` (Chrome)
- `src/background.ts` selects the backend by `BUILD_TARGET` and injects it — the
  runtime `if (clipboardAPI) … else if (offscreenService) … else throw` is gone.
- `createBrowserClipboardServiceController(realService)` owns only the runtime mock
  toggle, persistence, the E2E globals, and the single empty-text rule. It is the
  sole producer of the `boolean` no-op signal (empty text → `false`).
- Removed `createClipboardService` and `createBrowserClipboardService`.
- Mock recorder methods (`getCalls`/`reset`/`getLastCall`) moved off the base
  interface onto `MockClipboardService`.

## Why
Brings the clipboard service in line with `MarkdownConverter`: an interface whose
concrete implementation is chosen at the composition root, with no runtime
API-availability checks. Per-target bundles now carry only their own backend. The
boolean return is now honest — it lives only where it is meaningful (the controller's
empty-text no-op), which also drops a latent quirk where a mock storage-save failure
surfaced as a misleading "empty result".

## Behavior
No user-visible change. The empty-result UX (badge vs. feedback) is preserved. E2E
mock hooks unchanged. typecheck / lint / unit+browser / Chrome e2e green.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-08-clipboard-service-backend-injection-pr-note.md
git commit -m "docs: PR note for clipboard backend injection"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** navigator backend (Task 1 Step 5); offscreen returns `Promise<void>` (Task 1 Step 4); controller injection + empty-text centralization + sole boolean producer + `MockClipboardService` split (Task 1 Step 5); `BUILD_TARGET` root selection (Task 1 Step 6); removed `createClipboardService`/`createBrowserClipboardService` (Task 1 Step 5); tests incl. updated offscreen assertion (Task 1 Steps 1-2); per-target DCE verification (Task 2 Step 2); E2E hooks preserved (Task 1 Step 5 keeps `__mockClipboardService`/`setMockClipboardMode`; Task 2 Step 3 verifies).
- **Type consistency:** factory names stable — `createNavigatorClipboardService`, `createOffscreenClipboardService`, `createMockClipboardService`, `createBrowserClipboardServiceController`. Interfaces: `ClipboardService` (`copy → Promise<void>`), `MockClipboardService`, `ClipboardServiceController` (`copy → Promise<boolean>`, standalone — does NOT extend `ClipboardService`), `ClipboardMockCall` (stays exported; imported by `test/e2e/helpers.ts`).
- **Return-type discipline:** every backend (`navigator`, `offscreen`, `mock`) resolves `void`; only `ClipboardServiceController.copy` resolves `boolean`. Tests assert `toBeUndefined()` on backends, `toBe(true)`/`toBe(false)` only on the controller.
- **No new infra:** no build-assertion script added (Task 2 Step 2 is a one-time manual grep), per the design decision.
```
