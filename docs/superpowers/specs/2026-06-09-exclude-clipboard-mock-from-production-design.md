# Design: exclude the clipboard mock from production builds

**Date:** 2026-06-09
**Status:** Approved design — ready for implementation plan.
**Relationship:** Follows the clipboard backend-injection refactor
(`docs/superpowers/specs/2026-06-08-clipboard-service-interface-design.md`). That work
isolated the runtime mock toggle in the controller; this work removes that toggle (and the
whole mock surface) from production bundles while keeping it in the e2e build.

## Goal

The clipboard mock exists solely for e2e tests (it records copies to `storage.session`
instead of writing the system clipboard, and exposes hooks E2E drives). It must **never
ship in a production build**, yet must remain fully available in the e2e test build.

Production runtime behavior is unchanged — the mock is already inert in production (it is
only ever activated by E2E). This change makes it *absent from the compiled output*, not
merely inactive.

## Mechanism: a `BUILD_PROFILE` compile-time define (orthogonal to `BUILD_TARGET`)

The build already has one compile-time `define`, `BUILD_TARGET` (`'chrome' | 'firefox-mv3'`),
injected by esbuild and dead-code-eliminated per target. `BUILD_TARGET` is the **platform**
axis. Test-instrumentation (mock on/off) is a **separate, orthogonal axis** — the e2e build
is the cross product `(platform × e2e)`, not a new platform. (Encoding it as new
`BUILD_TARGET` values like `chrome-test`/`firefox-test` was rejected: `firefox-test` would
stop matching the ~6 existing `BUILD_TARGET === 'firefox-mv3'` platform checks and route the
Firefox build down the Chrome/offscreen path; and `chrome-test`/`chrome-optional-test` share
identical compiled JS, so they cannot be distinct code targets.)

Add a second define:

```ts
// src/types/build-profile.d.ts
declare const BUILD_PROFILE: 'production' | 'e2e';
```

- **esbuild** (`scripts/build.js`): `define: { BUILD_PROFILE: JSON.stringify(profile) }`,
  where `profile` defaults to `'production'` and is `'e2e'` for the test build.
- **tsc**: the ambient `declare const` above (mirrors `build-target.d.ts`).
- **vitest** (`vitest.config.ts`): root-level `define: { BUILD_PROFILE: JSON.stringify('e2e') }`,
  so BOTH test projects (unit + browser) compile with the mock available.

`BUILD_TARGET` stays exactly `'chrome' | 'firefox-mv3'` — none of its branch sites change.

## Gating pattern (DCE-friendly)

Reference `BUILD_PROFILE` in a boolean position so esbuild constant-folds it in production
(`'production' === 'e2e'` → `false`) and tree-shakes the now-unreachable mock code. tsc and
eslint see the full source (both branches live), so there are no unreachable/unused-var
lint errors — DCE happens only in esbuild.

### `src/services/clipboard-service.ts`

`createMockClipboardService` and `MockClipboardService` stay exported (unit tests import
them; in production they become unreferenced and tree-shake out). The controller's mock
machinery is gated:

```ts
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

async function setMockMode(enabled: boolean): Promise<void> {
  if (BUILD_PROFILE !== 'e2e') return;
  /* ...existing toggle + persist... */
}

async function initializeMockState(): Promise<void> {
  if (BUILD_PROFILE !== 'e2e') return;
  /* ...existing restore-from-storage... */
}

return {
  copy: async (text) => (text === '' ? false : (await activeService().copy(text), true)),
  setMockMode,
  initializeMockState,
  isMockMode: () => (BUILD_PROFILE === 'e2e' ? mockMode : false),
};
```

Production result: the controller collapses to "empty-text → `false`, else delegate to the
real backend." `createMockClipboardService`, the `storage.session` recorder, the
`__mockClipboardService` global, `persistMockState`, and the `mockMode` state all
tree-shake away. Only empty method shells remain (`setMockMode → return`,
`initializeMockState → return`, `isMockMode → false`) — they contain no mock logic.

### `src/background.ts`

Wrap each mock touch-point so it DCEs in production:

- the `setMockClipboardMode` global assignment (line ~59),
- the `clipboardService.initializeMockState()` startup call (line ~55),
- the `check-mock-clipboard` handler (line ~200) and the `set-mock-clipboard` handler
  (line ~245),

each behind `if (BUILD_PROFILE === 'e2e')` (for the message handlers, fold the topic check:
`if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'set-mock-clipboard')`).

### `src/ui/popup.ts`

```ts
useMockClipboard = BUILD_PROFILE === 'e2e' ? await checkMockClipboardAvailable() : false;
// ...
if (BUILD_PROFILE === 'e2e' && useMockClipboard) {
  /* route the copy through the background mock */
} else {
  await navigator.clipboard.writeText(text); // production path, unchanged
}
```

Production: `useMockClipboard` is always `false`, the mock branch DCEs, and
`checkMockClipboardAvailable` tree-shakes. The popup keeps its existing
`navigator.clipboard.writeText` behavior.

### `src/contracts/messages.ts`

The `CheckMockClipboardMessage` / `SetMockClipboardMessage` interfaces are type-only (erased
at compile, zero runtime output). Left unchanged — they type the test build's messages.

## Build pipeline

A platform extension dir is just two things: `<platform>/manifest.json` (a tracked source
file) and `<platform>/dist/` (everything esbuild + `copyAssets` produce — JS, `static/`,
`vendor/`). Today `scripts/build-test-extension.js` predates esbuild (it was written for the
tsc build): it copies the entire prebuilt `chrome/` → `chrome-test/` and rewrites only the
manifest permissions, which is why production and e2e ship identical JS. Now that esbuild is
a callable step, the test build should **compile directly into the test dirs** rather than
copy-then-recompile.

- **Factor the esbuild build out of `scripts/build.js`** into a reusable module, e.g.
  `scripts/lib/build-extension.js` exporting `buildExtension({ target, outdir, profile })`,
  that runs esbuild (with both the `BUILD_TARGET` and `BUILD_PROFILE` defines) and copies
  assets into `outdir`. `build.js`'s CLI stays a thin wrapper calling it with
  `profile: 'production'`, `outdir: <target>/dist`.
- **`scripts/build-test-extension.js`**: for each variant (`chrome-test`,
  `chrome-optional-test`, `firefox-test`), do exactly two things — no copy of production
  output:
  1. `buildExtension({ target: <platform>, outdir: <variant>/dist, profile: 'e2e' })`
     (`chrome` for the two chrome variants, `firefox-mv3` for firefox) — produces the
     mock-bearing JS + assets.
  2. Read the source `<platform>/manifest.json`, apply the existing permission rewrite, and
     write the result to `<variant>/manifest.json`.

  The variant dir is cleaned first (as today). Nothing from production `chrome/` /
  `firefox-mv3/` is read or copied.
- **`test:e2e:build` drops its `npm run build &&` prefix** → just
  `node scripts/build-test-extension.js`. The e2e build is now self-contained (it builds only
  the test dirs it needs) and faster. Producing/validating the production bundles is a
  separate concern handled by `npm run build` (which runs the mock assertion, below) in
  CI/packaging.

## Verification guard

A standing guard that the mock never re-enters production (mirrors
`scripts/assert-no-turndown.js`):

- **`scripts/assert-no-clipboard-mock.js`** — scan the production output JS
  (`chrome/dist/**/*.js` and `firefox-mv3/dist/**/*.js`) for mock sentinels and fail the
  build if any is found. Sentinels (survive because the build never minifies):
  `mockClipboardCalls` (the storage key), `__mockClipboardService` (the E2E global), and
  `createMockClipboardService` (the factory name). It checks ONLY the production dirs — the
  `*-test` dirs legitimately contain the mock.
- **Wire it into `package.json`**: run it in `build-chrome` and `build-firefox-mv3` after the
  build (alongside the existing `assert-no-turndown` in `build-chrome`).
- **`test/build/no-clipboard-mock-in-production.test.ts`** — a build test mirroring
  `test/build/no-turndown-in-chrome-background.test.ts`, asserting the production bundles
  carry no mock sentinel.

## Testing

- **Unit tests** (`test/services/clipboard-service.test.ts`) exercise
  `createMockClipboardService` and the controller's mock toggle. They pass unchanged because
  vitest defines `BUILD_PROFILE='e2e'`.
- **e2e** is behaviorally unchanged: after `build-test-extension.js` compiles the `*-test`
  dirs directly with `BUILD_PROFILE='e2e'`, the `setMockClipboardMode` /
  `__mockClipboardService` globals and the `set-mock-clipboard` / `check-mock-clipboard`
  messages all exist exactly as before.
- **New guard** proves production `dist` is mock-free (assertion + build test).
- Full gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (now incl. the
  mock assertion), `npm run test:e2e` (Chrome). Known-flaky parallel-clipboard e2e test:
  re-run in isolation if it trips.

## Scope / non-goals

- **In scope:** `src/types/build-profile.d.ts` (new ambient decl), `scripts/lib/build-extension.js`
  (new shared `buildExtension` factored out of build.js), `scripts/build.js` (thin wrapper +
  `BUILD_PROFILE` define), `scripts/build-test-extension.js` (compile variants directly with
  `profile: 'e2e'`, no prod-copy), `scripts/assert-no-clipboard-mock.js` (new), `package.json`
  (wire the assertion; drop the `npm run build &&` prefix from `test:e2e:build`),
  `vitest.config.ts` (define `BUILD_PROFILE`), `src/services/clipboard-service.ts`,
  `src/background.ts`, `src/ui/popup.ts`, and the new `test/build/` test.
- **Out of scope:** any user-visible behavior change; `BUILD_TARGET` / the converter; the
  clipboard backend-injection refactor itself; renaming or restructuring the mock API beyond
  gating it.

## Rejected alternatives

- **New `BUILD_TARGET` values (`chrome-test` / `firefox-test`):** conflates the platform and
  test axes, breaks the existing `=== 'firefox-mv3'` platform checks, and can't model
  `chrome-test` vs `chrome-optional-test` (identical JS). Rejected.
- **Clipboard-specific boolean (`INCLUDE_CLIPBOARD_MOCK`):** works and is orthogonal, but a
  named `BUILD_PROFILE` reads better and generalizes to future test-only hooks. Superseded.
- **Ship-but-inert (status quo):** does not meet the goal (the mock must be absent from the
  build). Rejected.

---

## Kickoff prompt (for a fresh Claude Code session)

> The design note lives on branch `idea/exclude-clipboard-mock-from-production`, which is
> **based on `refactor/clipboard-service-backend-injection`** (the clipboard backend-injection
> refactor this work builds on). This work assumes the *post-refactor* `clipboard-service.ts`
> (a slimmed controller that takes an injected real backend; `createMockClipboardService`
> returns a segregated `MockClipboardService`; `copy(text): Promise<void>`). Confirm your base
> before starting — see START HERE.

```
Exclude the clipboard mock from PRODUCTION builds of this web-extension repo (copy-as-markdown),
while keeping it fully available in the e2e test build. Plan before code.

START HERE — read these first, don't re-derive them:
- The design note for this task:
  docs/superpowers/specs/2026-06-09-exclude-clipboard-mock-from-production-design.md
  It lives on branch `idea/exclude-clipboard-mock-from-production` (NOT master). That branch is
  based on `refactor/clipboard-service-backend-injection`, which carries the clipboard
  backend-injection refactor this work DEPENDS ON.
  - If that refactor has merged to master: branch off master (it now has the refactored code) and
    bring the design note along.
  - If not: continue on `idea/exclude-clipboard-mock-from-production` (it already carries both the
    refactor commits and the note).
  SANITY CHECK before starting: src/services/clipboard-service.ts must already have
  `createBrowserClipboardServiceController(realService: ClipboardService, ...)` and
  `createMockClipboardService(): MockClipboardService`. If instead you find `createClipboardService`
  / `createBrowserClipboardService` with `if (clipboardAPI) ... else if (offscreenService) ... throw`,
  you are on the WRONG base (pre-refactor) — STOP and fix the base first.
- src/services/clipboard-service.ts, src/background.ts, src/ui/popup.ts,
  src/contracts/messages.ts, src/types/build-target.d.ts, scripts/build.js,
  scripts/build-test-extension.js, scripts/assert-no-turndown.js,
  test/build/no-turndown-in-chrome-background.test.ts, vitest.config.ts, package.json

CONTEXT — what's already true (verify, don't trust blindly)
- The build has ONE compile-time define today: BUILD_TARGET ('chrome' | 'firefox-mv3'), injected by
  esbuild in scripts/build.js and ambiently declared in src/types/build-target.d.ts, with per-target
  dead-code elimination. BUILD_TARGET is the PLATFORM axis.
- The clipboard mock currently ships in PRODUCTION. Surface: createMockClipboardService (records
  copies to storage.session) + MockClipboardService in clipboard-service.ts; the controller's mock
  machinery (setMockMode/isMockMode/initializeMockState, the __mockClipboardService global,
  mock-state persistence); the setMockClipboardMode global + the set-mock-clipboard /
  check-mock-clipboard handlers in background.ts; and the useMockClipboard / checkMockClipboardAvailable
  branch in popup.ts. It ships because the e2e build is the production build with only the manifest
  rewritten — scripts/build-test-extension.js copies chrome/ -> chrome-test/ and edits permissions;
  it NEVER recompiles (it predates esbuild; it was written for the old tsc build).

GOAL
Make the clipboard mock ABSENT from production bundles (not merely inactive) while keeping it fully
available in the e2e build. Production runtime behavior must be identical.

KEY DESIGN POINTS (full detail in the design note)
- Add a SECOND, orthogonal compile-time define: BUILD_PROFILE ('production' | 'e2e'). Do NOT fold
  test-ness into BUILD_TARGET — new 'chrome-test'/'firefox-test' values would break every existing
  `BUILD_TARGET === 'firefox-mv3'` platform check and conflate two orthogonal axes. Add an ambient
  `declare const` (src/types/build-profile.d.ts) for tsc; an esbuild define defaulting to 'production';
  and a vitest define of 'e2e' (root-level, both projects) so tests run with the mock available.
- Gate every mock touch-point on `BUILD_PROFILE === 'e2e'` so esbuild DCE strips it from production:
  the controller's mock machinery in clipboard-service.ts (activeService mock branch; setMockMode /
  initializeMockState early-return when not e2e; isMockMode; the __mockClipboardService global sync),
  the background.ts globals + initializeMockState() startup call + the two mock message handlers, and
  the popup's useMockClipboard / checkMockClipboardAvailable branch. createMockClipboardService /
  MockClipboardService stay exported (unit tests import them) and tree-shake from production when
  unreferenced. tsc/eslint see the full source (both branches live), so no unreachable/unused-var
  errors — DCE happens only in esbuild.
- Build pipeline: factor scripts/build.js's esbuild step into a reusable module
  (scripts/lib/build-extension.js, buildExtension({ target, outdir, profile })); build.js becomes a
  thin wrapper (profile 'production'). Rewrite scripts/build-test-extension.js to COMPILE DIRECTLY
  into each test dir (chrome-test, chrome-optional-test, firefox-test) with profile 'e2e' + the
  existing manifest permission rewrite (reading the source <platform>/manifest.json) — NO copying of
  production output. Drop the `npm run build &&` prefix from the test:e2e:build script (the e2e build
  is now self-contained). A platform dir is just manifest.json (tracked source) + dist/ (esbuild
  output), so a direct compile + manifest write is the whole extension.
- Verification guard: add scripts/assert-no-clipboard-mock.js mirroring assert-no-turndown.js — scan
  the PRODUCTION chrome/dist and firefox-mv3/dist JS for the sentinels `mockClipboardCalls`,
  `__mockClipboardService`, `createMockClipboardService` and fail if any appears (production dirs ONLY;
  the *-test dirs legitimately contain the mock). Wire it into build-chrome and build-firefox-mv3. Add
  test/build/no-clipboard-mock-in-production.test.ts mirroring no-turndown-in-chrome-background.test.ts.

SCOPE / NON-GOALS
- In scope: src/types/build-profile.d.ts (new), scripts/lib/build-extension.js (new, factored),
  scripts/build.js, scripts/build-test-extension.js, scripts/assert-no-clipboard-mock.js (new),
  package.json (wire assertion; drop test:e2e:build prefix), vitest.config.ts (define BUILD_PROFILE),
  src/services/clipboard-service.ts, src/background.ts, src/ui/popup.ts,
  test/build/no-clipboard-mock-in-production.test.ts.
- Out of scope: any user-visible behavior change; BUILD_TARGET / the markdown converter; the clipboard
  backend-injection refactor itself; restructuring the mock API beyond gating it. messages.ts mock
  message types are type-only (zero runtime) — leave them.

CONSTRAINTS
- Preserve the E2E mock hooks EXACTLY in the e2e build: setMockClipboardMode global,
  __mockClipboardService global, the set-mock-clipboard / check-mock-clipboard messages, persisted
  mock state, and the recorded-call shape waitForMockClipboard / getMockClipboardCalls read (.text).
- All checks green: npm run typecheck, npm run lint, npm test (vitest unit + browser), npm run build
  (now incl. the mock assertion), npm run test:e2e (Chrome). Known-flaky parallel-clipboard e2e test:
  re-run in isolation if it trips.
- Never work on master directly.

HOW TO PROCEED
1. Confirm the base (see START HERE / SANITY CHECK) and read the design note end to end.
2. Brainstorm/confirm with me (superpowers brainstorming skill): the BUILD_PROFILE define, the DCE
   gating pattern, the direct-compile build-test-extension rewrite, and the assertion sentinels.
3. writing-plans skill -> step-by-step plan under docs/superpowers/plans/, TDD, small commits.
4. Implement (subagent-driven-development or executing-plans).

ACCEPTANCE CRITERIA
- BUILD_PROFILE ('production' | 'e2e') exists as an orthogonal define; BUILD_TARGET unchanged.
- Production chrome/dist and firefox-mv3/dist contain NO mock code (no mockClipboardCalls,
  __mockClipboardService, or createMockClipboardService), enforced by
  scripts/assert-no-clipboard-mock.js + test/build/no-clipboard-mock-in-production.test.ts.
- The e2e build (chrome-test / chrome-optional-test / firefox-test) is compiled DIRECTLY with
  BUILD_PROFILE='e2e' (no production copy) and still carries the full mock + E2E hooks; all e2e tests
  pass unchanged.
- Production extension runtime behavior is identical; the popup uses navigator.clipboard.writeText.
- typecheck, lint, npm test, npm run build, and Chrome e2e all green.
- A short PR note summarizing the new build shape.

Begin by confirming your branch base, reading the design note, and checking how scripts/build.js +
scripts/build-test-extension.js currently work, then come back with a brainstorming summary and open
questions before writing the plan.
```
