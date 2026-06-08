# Design: inject the chosen clipboard backend (mirror MarkdownConverter)

**Date:** 2026-06-08
**Status:** Approved design — ready for implementation plan.
**Origin idea:** `docs/superpowers/ideas/clipboard-service-interface.md` (Option 1).

## Goal

Complete the clipboard side of the "inject-the-chosen-backend" pattern so the
clipboard service does **no runtime API-availability checks** — exactly like
`MarkdownConverter` already does. Replace the runtime branch inside
`createClipboardService` (`if (clipboardAPI) … else if (offscreenService) … else throw`)
with two peer backends selected at the composition root by `BUILD_TARGET`.

Runtime behavior must be **identical** (no user-visible change). This is a structural
refactor plus the removal of two pieces of dead surface area (see "Return type" and
"Vestigial `tab`" below).

## Current state (verified against this branch)

- `BUILD_TARGET` (`'chrome' | 'firefox-mv3'`) is injected by esbuild's `define`
  (`scripts/build.js`), declared ambiently in `src/types/build-target.d.ts`, with
  dead-code elimination per target. The Markdown converter is already migrated to a
  two-peer, `BUILD_TARGET`-selected shape — the model this refactor mirrors.
- The Chrome backend already exists as a clean injectable:
  `createOffscreenClipboardService(documentService)` in
  `src/services/offscreen-clipboard-service.ts`.
- Axis A (target backend) is *already* chosen at the root by `BUILD_TARGET` in
  `src/background.ts`. **There is no `src/config/flags.ts` / `Flags.alwaysUseNavigatorClipboard()`**
  — the original idea doc's flag cleanup is a no-op.
- The remaining smell: `background.ts` passes **both** `navigator.clipboard | null`
  **and** `offscreenDocumentService` into the controller, which **re-derives Axis A
  internally** via `createBrowserClipboardService → createClipboardService`'s runtime
  `if/else if/throw`. That runtime branch is what this refactor deletes.

## Two orthogonal axes (do not conflate)

| Axis | Choice | Decided when | Home |
|------|--------|--------------|------|
| **A. Target backend** | navigator (Firefox) vs offscreen (Chrome) | **Compile time**, `BUILD_TARGET` branch at the composition root | `background.ts`, injected into the controller |
| **B. Mock vs real** | record-to-storage mock vs real write | **Runtime** — E2E flips it live | the controller only |

Axis A resolves at the root and is injected. Axis B is genuinely runtime and stays
in the controller (it swaps mock⇄real live and persists the preference).

## Target shape of `src/services/clipboard-service.ts`

```ts
export interface ClipboardMockCall {
  text: string;
  timestamp: number;
}

export interface ClipboardService {
  // Write text to the clipboard, or throw. A backend never reports a "soft
  // failure" — it either succeeds or raises.
  copy: (text: string) => Promise<void>;
}

// Mock-only recorder methods segregated off the base interface:
export interface MockClipboardService extends ClipboardService {
  getCalls: () => Promise<ClipboardMockCall[]>;
  reset: () => Promise<void>;
  getLastCall: () => Promise<ClipboardMockCall | undefined>;
}
```

**Why `Promise<void>` on the backend, not `Promise<boolean>`:** both real backends
only ever resolve "wrote it" or throw — neither can honestly return `false`. The only
meaningful `false` is the empty-text no-op, which is the controller's policy. So the
boolean lives exactly once, on the **controller** (`ClipboardServiceController.copy:
Promise<boolean>`), and backends are pure write-or-throw. This also removes a latent
quirk where the mock returned `false` on a storage-save failure (which background would
have surfaced as a misleading "empty result").

**Why no `tab` argument (removed):** the old `copy(text, tab?)` signature — and its
doc comment "If tab is not provided, will attempt to get the current active tab" —
existed only to support the pre-offscreen mechanism, which injected a content script
into the active tab's DOM via `scripting.executeScript({ target: { tabId } })` to run
`document.execCommand('copy')` (see commit `971d6a9`, "Use chrome.offscreen document to
perform clipboard write from service worker"). Since the offscreen-document (Chrome) and
Event-Page (Firefox) migrations, no backend needs a tab: `navigator.clipboard.writeText`
and the offscreen document both write without one. The `tab` parameter is dead — no
backend reads it, and although the mock recorded it into `ClipboardMockCall.tab`, no test
or helper ever read that field (every assertion reads `.text`). So `tab` is dropped from
`copy`, from the controller, from the mock, and the `ClipboardMockCall.tab` field is
removed, along with the stale doc comment.

### Backends (peers, no runtime checks, no empty-text rule)

- **New** `createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService`
  — the extracted Firefox branch:
  ```ts
  return { copy: async (text) => { await clipboardAPI.writeText(text); } };
  ```
- `createOffscreenClipboardService(documentService)` returns `ClipboardService` (its
  `copy(text): Promise<void>` resolves on a successful write, otherwise throws). The
  standalone `OffscreenClipboardService` interface is **removed**.

### Mock

- `createMockClipboardService(): MockClipboardService` — **drops** its own
  `if (text === '') return false` guard (now centralized in the controller), its
  `boolean` return (`copy` is now `Promise<void>`; it still logs on a storage error),
  and the recorded `tab`. Keeps the storage-backed recorder behavior and the
  `getCalls`/`reset`/`getLastCall` methods.

### Controller (owns Axis B + the empty-text rule)

`createBrowserClipboardServiceController(realService: ClipboardService, options?)`:

```ts
export function createBrowserClipboardServiceController(
  realService: ClipboardService,
  options?: { storageArea?: browser.storage.StorageArea; storageKey?: string; defaultMockState?: boolean },
): ClipboardServiceController {
  let mockMode = /* defaultMockState */ false;
  let mockService: MockClipboardService | null = null;
  const active = (): ClipboardService =>
    mockMode ? (mockService ??= createMockClipboardService()) : realService;
  // ... persistence + __mockClipboardService global, unchanged ...
  return {
    // The controller is the SOLE producer of the boolean: false = empty no-op,
    // true = a write was delegated (the backend either wrote or threw).
    copy: async (text) => {
      if (text === '') return false;
      await active().copy(text);
      return true;
    },
    setMockMode, initializeMockState, isMockMode,
  };
}
```

`ClipboardServiceController` no longer `extends ClipboardService` — its `copy(text)`
returns `Promise<boolean>` (the empty-text signal background consumes), whereas the
backend `ClipboardService.copy(text)` returns `Promise<void>`. It is declared as a
standalone interface with `copy`, `setMockMode`, `initializeMockState`, `isMockMode`.

- **Empty-text rule lives here, once.** It short-circuits before delegating to the
  active service, covering both mock and real paths (background routes all copies
  through the controller).
- Persistence, `setMockMode`, `initializeMockState`, `isMockMode`, and the
  `__mockClipboardService` global behave exactly as today.

### Removed

- `createClipboardService(clipboardAPI, offscreenService)` — the runtime-branching core.
- `createBrowserClipboardService(clipboardAPI, offscreenDocumentService, mockMode)`.
- The standalone `OffscreenClipboardService` interface.
- The optional `getCalls?`/`reset?`/`getLastCall?` members on the base `ClipboardService`.
- The `tab` parameter on `copy` and the `tab` field on `ClipboardMockCall`.

## `src/background.ts`

```ts
const realClipboard: ClipboardService = BUILD_TARGET === 'firefox-mv3'
  ? createNavigatorClipboardService(navigator.clipboard)
  : createOffscreenClipboardService(offscreenDocumentService!);

const clipboardService = createBrowserClipboardServiceController(realClipboard);
```

`offscreenDocumentService` is already gated behind the Chrome branch (`null` on
Firefox), so the `!` is safe — the Firefox branch never touches it, and `BUILD_TARGET`
DCE removes the offscreen path from the Firefox bundle (and the navigator path from the
Chrome bundle). The `setMockClipboardMode` global and the `initializeMockState()` call
are unchanged. The two `clipboardService.copy(text, tab)` call sites drop their second
argument to `clipboardService.copy(text)` (the local `tab` stays in scope — the handlers
still pass it to `handleMenuClick` / `handleCommand`).

## Tests (`test/services/clipboard-service.test.ts`)

Replace the combined `createClipboardService` / `createBrowserClipboardService` tests
with:

- **`createNavigatorClipboardService`** — `copy('hello')` calls `clipboardAPI.writeText`
  once and resolves (returns `void`/`undefined`).
- **`createOffscreenClipboardService`** — covered by the existing
  `test/services/offscreen-clipboard-service.test.ts`, which must be **updated**: its
  `copy(...)` success assertion changes from `resolves.toBe(true)` to
  `resolves.toBeUndefined()` (the throw-on-failure assertions are unchanged).
- **Controller** (the only place the boolean is asserted) —
  - empty text resolves `false` **without** touching the injected real backend;
  - non-empty resolves `true` and delegates to the real backend (called with just the text);
  - `setMockMode(true)` routes subsequent copies to a mock and exposes
    `__mockClipboardService`; `setMockMode(false)` restores the real backend and clears
    the global;
  - persistence / `initializeMockState` restore behavior (keep existing coverage).
- **Mock** — records non-empty copies (asserts on the storage write, not a boolean
  return; the recorded call has `text` + `timestamp`, no `tab`). The previous "does not
  record empty-string copies" test is **removed** (the guard moved); empty-text is now
  asserted at the controller level.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (vitest unit + browser),
  `npm run test:e2e` (Chrome — drives real clipboard writes through the offscreen path).
  Known flaky parallel-clipboard e2e test: re-run in isolation if it trips.
- Manual one-time bundle check during implementation: `chrome/dist/background.js` carries
  no `navigator.clipboard.writeText` path; the Firefox build carries no `chrome.offscreen`
  clipboard path. (No new build-assertion script — relying on `BUILD_TARGET` DCE, same as
  the converter.)

## Preserved invariants (E2E hooks)

`setMockClipboardMode` global, `__mockClipboardService` global, the
`set-mock-clipboard` / `check-mock-clipboard` messages, persisted mock state, and the
shape consumed by `waitForMockClipboard` / `getMockClipboardCalls` (`.text`) — all
unchanged.

## Scope / non-goals

- **In scope:** `clipboard-service.ts`, `offscreen-clipboard-service.ts` (return type
  alignment to `Promise<void>`), `background.ts` wiring + call-site `tab`-arg removal,
  and the clipboard unit tests (`clipboard-service.test.ts` rewrite +
  `offscreen-clipboard-service.test.ts` assertion update).
- **Out of scope:** the Markdown converter, `offscreen-document-service` internals, the
  build system (esbuild is done), any user-visible behavior change (the empty-result UX is
  preserved), and any new build-assertion infrastructure.

## Approach (rejected alternatives)

- **Option 2 — lower-level `ClipboardWriter` split:** over-engineering for a one-method
  surface; rejected.
- **Option 3 — status quo:** keeps the Axis-A runtime check and both interface smells;
  rejected.
