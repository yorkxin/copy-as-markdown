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
  // Write the text to the clipboard, or throw. A backend never reports a
  // "soft failure" — it either succeeds or raises.
  copy: (text: string, tab?: browser.tabs.Tab) => Promise<void>;
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

### Backends (peers, no runtime checks, no empty-text rule)

- **New** `createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService`
  — the extracted Firefox branch:
  ```ts
  return { copy: async (text) => { await clipboardAPI.writeText(text); } };
  ```
- `createOffscreenClipboardService(documentService)` returns `ClipboardService`. The
  standalone `OffscreenClipboardService` interface is **removed**; its `copy(text)`
  signature stays assignable to `copy(text, tab?)` (fewer params is assignable in TS).
  Both real backends ignore `tab` — only the mock records it.

### Mock

- `createMockClipboardService(): MockClipboardService` — **drops** its own
  `if (text === '') return false` guard (now centralized in the controller) and its
  `boolean` return (`copy` is now `Promise<void>`, matching the interface; it still logs
  on a storage error). Keeps the storage-backed recorder behavior and the
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
    copy: async (text, tab) => {
      if (text === '') return false;
      await active().copy(text, tab);
      return true;
    },
    setMockMode, initializeMockState, isMockMode,
  };
}
```

`ClipboardServiceController` no longer `extends ClipboardService` — its `copy` returns
`Promise<boolean>` (the empty-text signal background consumes), whereas the backend
`ClipboardService.copy` returns `Promise<void>`. It is declared as a standalone
interface with `copy`, `setMockMode`, `initializeMockState`, `isMockMode`.

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
  once and resolves (returns `void`/`undefined`).
- **`createOffscreenClipboardService`** — covered by the existing
  `test/services/offscreen-clipboard-service.test.ts`, which must be **updated**: its
  `copy(...)` success assertions change from `resolves.toBe(true)` to
  `resolves.toBeUndefined()` (the throw-on-failure assertions are unchanged).
- **Controller** (the only place the boolean is asserted) —
  - empty text resolves `false` **without** touching the injected real backend;
  - non-empty resolves `true` and delegates to the real backend;
  - `setMockMode(true)` routes subsequent copies to a mock and exposes
    `__mockClipboardService`; `setMockMode(false)` restores the real backend and clears
    the global;
  - persistence / `initializeMockState` restore behavior (keep existing coverage).
- **Mock** — records non-empty copies (asserts on the storage write, not a boolean
  return). The previous "does not record empty-string copies" test is **removed** (the
  guard moved); empty-text is now asserted at the controller level.

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
  alignment to `Promise<void>`), `background.ts` wiring, and the clipboard unit tests
  (`clipboard-service.test.ts` rewrite + `offscreen-clipboard-service.test.ts` assertion
  update).
- **Out of scope:** the Markdown converter, `offscreen-document-service` internals, the
  build system (esbuild is done), any user-visible behavior change (the empty-result UX is
  preserved), and any new build-assertion infrastructure.

## Approach (rejected alternatives)

- **Option 2 — lower-level `ClipboardWriter` split:** over-engineering for a two-method
  surface; rejected.
- **Option 3 — status quo:** keeps the Axis-A runtime check and both interface smells;
  rejected.
