# Idea: refactor ClipboardService to inject the chosen backend (mirror MarkdownConverter)

**Status:** Parked idea — to be done as its own PR, AFTER #259 (move Turndown off page contexts) lands.
**Date:** 2026-06-06
**Origin:** While reviewing #259, we noticed `MarkdownConverter` became a clean interface whose concrete implementation is chosen at the composition root (`background.ts`) by a flag and injected — the service does no runtime capability checks. The clipboard service does NOT yet follow this pattern fully. This doc proposes bringing it in line.

> **Assumes #259 is merged.** Line references and the "current state" below describe `src/services/clipboard-service.ts` as it exists on the `259-turndown-offscreen-conversion` branch (post-refactor), where `OffscreenDocumentService` and the injected document service already exist.

---

## Current state (post-#259)

The clipboard code is *partly* interface-shaped already:

- `ClipboardService` is an interface with three implementations (mock + two real backends).
- The **Chrome** backend is cleanly extracted and injectable: `createOffscreenClipboardService(documentService)` in `src/services/offscreen-clipboard-service.ts`.
- But the **Firefox** backend (`navigator.clipboard.writeText`) is INLINED inside `createClipboardService.copy_`, and the choice between the two real backends is made by **runtime branching on which argument is non-null**:

```ts
// src/services/clipboard-service.ts (createClipboardService)
async function copy_(text: string): Promise<boolean> {
  if (text === '') {
    return false;
  }
  // Firefox: write directly with navigator.clipboard from the background.
  if (clipboardAPI) {
    await clipboardAPI.writeText(text);
    return true;
  }
  // Chrome: write via the offscreen document.
  if (offscreenService) {
    return await offscreenService.copy(text);
  }
  throw new Error('no clipboard mechanism available');
}
```

That `if (clipboardAPI) … else if (offscreenService) … else throw` is exactly the "service performs runtime API-availability checks instead of receiving an already-chosen implementation" smell that `MarkdownConverter` deliberately avoids.

## Key insight: clipboard has TWO axes; the converter only had one

`MarkdownConverter` chooses along a SINGLE axis — which target backend (offscreen vs event-page) — knowable at the composition root from a build flag. Inject once, done.

`ClipboardService` chooses along TWO orthogonal axes:

| Axis | Choice | Decided when |
|------|--------|--------------|
| **A. Target backend** | navigator (Firefox) vs offscreen (Chrome) | Composition-root / build time, via `Flags.alwaysUseNavigatorClipboard()` |
| **B. Mock vs real** | record-to-storage mock vs real write | **Runtime** — E2E flips it live via the `set-mock-clipboard` message / `setMockClipboardMode` global |

- **Axis A** is a perfect fit for "inject the chosen implementation at the root," like the converter.
- **Axis B is genuinely runtime** and cannot collapse into a composition-root choice — this is why `ClipboardServiceController` exists (it swaps mock⇄real live and persists the preference). The converter never needed this.

So the correct target is NOT "delete the controller and inject one impl." It is: **resolve Axis A at the root and inject it; let the controller own ONLY Axis B.** Today the controller conflates both — it takes `clipboardAPI` AND `offscreenDocumentService` and re-derives Axis A internally via `createBrowserClipboardService`.

## Secondary smells to clean up

1. **Optional mock methods on the base interface** — `ClipboardService` carries optional `getCalls?`/`reset?`/`getLastCall?` that only the mock implements (interface-segregation violation). They belong on a separate `MockClipboardService` type.
2. **Duplicated empty-text rule** — `if (text === '') return false` lives in BOTH `createClipboardService` and `createMockClipboardService`. It is a cross-cutting policy that should sit in exactly one place.

## Proposed solutions

### Option 1 — Inject the chosen real backend (RECOMMENDED)

Make the two real backends peer implementations of `ClipboardService`, pick one by flag at the root, and slim the controller to only the mock axis.

```ts
// clipboard-service.ts
export interface ClipboardService {
  copy(text: string, tab?: browser.tabs.Tab): Promise<boolean>;
}

// Firefox backend — extracted from the inlined branch, no runtime checks:
export function createNavigatorClipboardService(clipboardAPI: ClipboardAPI): ClipboardService {
  return {
    copy: async (text) => {
      await clipboardAPI.writeText(text);
      return true;
    },
  };
}
// Chrome backend already exists: createOffscreenClipboardService(documentService)
```

```ts
// background.ts (composition root) — mirrors the converter wiring:
const realClipboard: ClipboardService = Flags.alwaysUseNavigatorClipboard()
  ? createNavigatorClipboardService(navigator.clipboard)
  : createOffscreenClipboardService(offscreenDocumentService!);

const clipboardService = createBrowserClipboardServiceController(realClipboard);
```

```ts
// controller owns ONLY the mock toggle + the shared empty-text rule:
export function createBrowserClipboardServiceController(
  realService: ClipboardService,
  options?: { storageArea?: browser.storage.StorageArea; storageKey?: string; defaultMockState?: boolean },
): ClipboardServiceController {
  let mockMode = /* restored */ false;
  let mockService: MockClipboardService | null = null;
  const active = (): ClipboardService => mockMode ? (mockService ??= createMockClipboardService()) : realService;
  return {
    copy: (text, tab) => text === '' ? Promise.resolve(false) : active().copy(text, tab),
    setMockMode, isMockMode, initializeMockState,
  };
}
```

Effects:
- `createClipboardService` (the runtime-branching core) and `createBrowserClipboardService(clipboardAPI, offscreenDocumentService, mockMode)` are REMOVED.
- Empty-text rule lives once (controller); backends and mock drop their copies.
- `MockClipboardService extends ClipboardService` with the recorder methods; base interface stops carrying optionals.
- The `__mockClipboardService` global + `setMockClipboardMode` global (E2E hooks) stay in the controller, unchanged.

**Pros:** eliminates runtime API-availability branching; Chrome/Firefox become symmetric injectable peers exactly like the converter; centralizes empty-text; segregates the mock interface.
**Cons:** touches `background.ts` wiring and the clipboard tests (the current "writes via injected offscreen doc service" test splits into separate per-backend tests).

### Option 2 — Option 1 + a lower-level `ClipboardWriter`

Split further: `ClipboardWriter { write(text): Promise<boolean> }` (the two real backends, pure) and a single `ClipboardService` that layers empty-text + `tab` + mock toggle on top of an injected writer. Cleaner separation of "how bytes reach the clipboard" from "policy," but an extra layer for a two-method surface — likely **over-engineering** unless the policy layer grows.

### Option 3 — Status quo

Defensible (the service already implements an interface; the runtime branch is tiny and commented), but keeps the Axis-A runtime check and both interface smells, and leaves the clipboard service inconsistent with the converter.

## Recommendation

**Option 1**, as its own PR after #259. It is the direct analog of the converter refactor, correctly scoped to the one axis that is a build-time choice, while preserving the runtime mock toggle the converter never had.

## Relationship to other work

- **#259 (MarkdownConverter):** this refactor makes `ClipboardService` consistent with `MarkdownConverter` (interface + inject-chosen-impl-at-root).
- **Parked esbuild idea (`esbuild-build-time-flags.md`):** both `alwaysUseNavigatorClipboard` and `convertMarkdownInBackground` are really "is this the Firefox build" flags. If esbuild `BUILD_TARGET` lands, Axis A for BOTH services collapses to a compile-time branch and the unused backend is tree-shaken out. Option 1 here is a prerequisite that makes that swap trivial for the clipboard side.

## Scope (when picked up)

Self-contained:
- `src/services/clipboard-service.ts` — add `createNavigatorClipboardService`, remove `createClipboardService` + `createBrowserClipboardService`, slim the controller to take an injected `ClipboardService`, split `MockClipboardService` type, centralize empty-text.
- `src/services/offscreen-clipboard-service.ts` — already a clean peer; possibly align its `copy(text)` signature to `ClipboardService.copy(text, tab?)`.
- `src/background.ts` — pick the real backend by flag and inject it.
- `test/services/clipboard-service.test.ts` — replace the combined test with per-backend tests + controller mock-toggle tests.

No interaction with `offscreen-document-service` or the converter.

---

## Kickoff prompt (for a fresh Claude Code session)

> Use this AFTER both #259 and the esbuild compile-time `BUILD_TARGET` migration are merged.
> Note the design above predates esbuild: it selects the backend with
> `Flags.alwaysUseNavigatorClipboard()`, but under esbuild that selection becomes a
> compile-time `BUILD_TARGET` branch (and the unused backend is tree-shaken out). The prompt
> reflects that.

```
Refactor the clipboard service in this web-extension repo (copy-as-markdown) to mirror the
MarkdownConverter pattern: an interface with target-specific implementations chosen at the
composition root, so the service does no runtime API-availability checks. Plan before code.

START HERE — read these first, don't re-derive them:
- The design note for this task lives on branch `idea/clipboard-service-interface`:
  docs/superpowers/ideas/clipboard-service-interface.md
  It is NOT on master. Read it from that branch
  (`git show idea/clipboard-service-interface:docs/superpowers/ideas/clipboard-service-interface.md`),
  then create your working branch off master and bring the note along (cherry-pick the commit
  or copy the file in) so it travels with the work.
- src/services/clipboard-service.ts, src/services/offscreen-clipboard-service.ts,
  src/services/offscreen-document-service.ts, src/background.ts, src/config/flags.ts,
  test/services/clipboard-service.test.ts

CONTEXT — what's already merged (verify against master, don't trust blindly)
- #259 (Turndown moved off page contexts) is merged: the offscreen document is a shared,
  reason-agnostic service (offscreen-document-service.ts) used by both clipboard writes and
  Markdown conversion; the Chrome clipboard backend already exists as a clean injectable,
  createOffscreenClipboardService(documentService).
- The esbuild compile-time build-flag migration is ALSO merged: there is a per-target
  `BUILD_TARGET` (`chrome` | `firefox`) define with dead-code elimination, and the
  Firefox/Chrome divergence is selected at compile time (the markdown converter was already
  migrated this way; the unused backend is tree-shaken out of each target bundle).
  IMPORTANT: because esbuild landed, the runtime flag the clipboard idea doc references —
  Flags.alwaysUseNavigatorClipboard() — may already be gone or partially migrated. CHECK
  src/config/flags.ts, firefox-mv3/hacks.js, and how src/background.ts currently selects the
  clipboard backend. Adapt: the doc's Option 1 picks the backend with the runtime flag, but
  here you must select it with a compile-time `BUILD_TARGET` branch instead.

GOAL
Complete the clipboard side of the inject-the-chosen-backend pattern. Today the two real
backends are selected by runtime branching inside createClipboardService
(`if (clipboardAPI) … else if (offscreenService) … else throw`) — the exact runtime-check
smell MarkdownConverter avoids. Replace it with:
- A ClipboardService interface and two PEER implementations:
    * Firefox: createNavigatorClipboardService(clipboardAPI)  (extract the inlined
      navigator.clipboard.writeText branch into its own impl, no runtime checks)
    * Chrome:  createOffscreenClipboardService(documentService)  (already exists)
- Composition-root selection by BUILD_TARGET (compile-time), so each target's bundle contains
  ONLY its backend (navigator path tree-shaken from Chrome; offscreen/chrome.offscreen path
  tree-shaken from Firefox). Likewise gate createBrowserOffscreenDocumentService() behind the
  Chrome branch.
- Remove the runtime-branching core (createClipboardService) and the
  createBrowserClipboardService(clipboardAPI, offscreenDocumentService, mockMode) factory.

KEY DESIGN POINT — two orthogonal axes (don't conflate them)
- Axis A: target backend (navigator vs offscreen) → COMPILE-TIME, BUILD_TARGET branch at the
  root. Inject the chosen ClipboardService.
- Axis B: mock vs real → RUNTIME. E2E flips it live via the `set-mock-clipboard` message and
  the setMockClipboardMode / __mockClipboardService globals. This MUST stay in the controller.
  Slim createBrowserClipboardServiceController to take an injected real ClipboardService and
  own ONLY the mock toggle + persistence; it should no longer re-derive Axis A internally.

ALSO CLEAN UP (per the doc)
- Move the mock-only methods (getCalls/reset/getLastCall) off the base ClipboardService onto a
  separate MockClipboardService type (interface segregation).
- Centralize the `if (text === '') return false` rule in exactly one place (the controller),
  removing the duplicate copies in the backends/mock.

SCOPE / NON-GOALS
- In scope: clipboard-service.ts, offscreen-clipboard-service.ts (possibly align its copy(text)
  signature to ClipboardService.copy(text, tab?)), background.ts wiring, flags cleanup if a
  clipboard runtime flag is now redundant under BUILD_TARGET, and clipboard tests.
- Out of scope: the markdown converter, the offscreen-document-service internals, the build
  system itself (esbuild is done), and any feature behavior change. Runtime behavior must be
  identical.

CONSTRAINTS
- Preserve the E2E mock hooks exactly: setMockClipboardMode global, __mockClipboardService
  global, the `set-mock-clipboard` / `check-mock-clipboard` messages, and persisted mock state.
- All checks green: `npm run typecheck`, `npm run lint`, `npm test` (vitest "unit" + "browser"
  projects), and `npm run test:e2e` (Chrome — drives real clipboard writes through the offscreen
  path). Known flaky parallel-clipboard e2e test: re-run in isolation if it trips.
- Branch off master; never work on master directly.

HOW TO PROCEED
1. Brainstorm with me first (superpowers brainstorming skill): confirm the BUILD_TARGET-adapted
   Option 1 vs the heavier ClipboardWriter split (Option 2 in the doc — likely over-engineering),
   how the offscreen-clipboard-service signature aligns to the interface, and exactly which
   flags/hacks.js entries are now removable.
2. Then writing-plans skill → step-by-step plan under docs/superpowers/plans/, TDD, small commits.
3. Then implement (subagent-driven-development or executing-plans).

ACCEPTANCE CRITERIA
- ClipboardService is an interface with two peer backends; no runtime API-availability branch
  anywhere (the old `if (clipboardAPI) … else if (offscreenService)` is gone).
- Backend chosen at the composition root by BUILD_TARGET; each target bundle contains only its
  backend (verify the Firefox build doesn't carry chrome.offscreen code and the Chrome build
  doesn't carry the navigator path).
- Controller owns only the mock toggle; empty-text rule centralized; MockClipboardService split
  off the base interface.
- typecheck, lint, npm test, and Chrome e2e all green; E2E mock-clipboard behavior unchanged.
- A short PR note summarizing the new shape.

Begin by reading the design note from branch idea/clipboard-service-interface and the current
clipboard wiring in src/background.ts + src/config/flags.ts (to see what the esbuild migration
already changed), then come back with a brainstorming summary and open questions before writing
the plan.
```
