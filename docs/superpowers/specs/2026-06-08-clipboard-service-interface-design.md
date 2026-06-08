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

Runtime behavior must be **identical**. This is a structural refactor.

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
export interface ClipboardService {
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<boolean>;
}

// Mock-only recorder methods segregated off the base interface:
export interface MockClipboardService extends ClipboardService {
  getCalls: () => Promise<ClipboardMockCall[]>;
  reset: () => Promise<void>;
  getLastCall: () => Promise<ClipboardMockCall | undefined>;
}
```

### Backends (peers, no runtime checks, no empty-text rule)

- **New** `createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService`
  — the extracted Firefox branch:
  ```ts
  return { copy: async (text) => { await clipboardAPI.writeText(text); return true; } };
  ```
- `createOffscreenClipboardService(documentService)` returns `ClipboardService`. The
  standalone `OffscreenClipboardService` interface is **removed**; its `copy(text)`
  signature stays assignable to `copy(text, tab?)` (fewer params is assignable in TS).
  Both real backends ignore `tab` — only the mock records it.

### Mock

- `createMockClipboardService(): MockClipboardService` — **drops** its own
  `if (text === '') return false` guard (now centralized in the controller). Keeps the
  storage-backed recorder behavior and the `getCalls`/`reset`/`getLastCall` methods.

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
    copy: (text, tab) => text === '' ? Promise.resolve(false) : active().copy(text, tab),
    setMockMode, initializeMockState, isMockMode,
  };
}
```

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
Chrome bundle). The `setMockClipboardMode` global, `initializeMockState()` call, and
every `clipboardService.copy(...)` call site are unchanged.

## Tests (`test/services/clipboard-service.test.ts`)

Replace the combined `createClipboardService` / `createBrowserClipboardService` tests
with:

- **`createNavigatorClipboardService`** — `copy('hello')` calls `clipboardAPI.writeText`
  once and resolves `true`.
- **`createOffscreenClipboardService`** — `copy('hi')` delegates to the injected document
  service (`sendMessage` with the text) and resolves `true`.
- **Controller** —
  - empty text resolves `false` **without** touching the injected real backend;
  - non-empty delegates to the real backend;
  - `setMockMode(true)` routes subsequent copies to a mock and exposes
    `__mockClipboardService`; `setMockMode(false)` restores the real backend and clears
    the global;
  - persistence / `initializeMockState` restore behavior (keep existing coverage).
- **Mock** — records non-empty copies. The previous "does not record empty-string copies"
  test is **removed** (the guard moved); empty-text is now asserted at the controller level.

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
`set-mock-clipboard` / `check-mock-clipboard` messages, and persisted mock state — all
unchanged.

## Scope / non-goals

- **In scope:** `clipboard-service.ts`, `offscreen-clipboard-service.ts` (return type
  alignment), `background.ts` wiring, clipboard tests.
- **Out of scope:** the Markdown converter, `offscreen-document-service` internals, the
  build system (esbuild is done), any feature/behavior change, and any new build-assertion
  infrastructure.

## Approach (rejected alternatives)

- **Option 2 — lower-level `ClipboardWriter` split:** over-engineering for a two-method
  surface; rejected.
- **Option 3 — status quo:** keeps the Axis-A runtime check and both interface smells;
  rejected.
