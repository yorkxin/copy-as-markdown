# Design: ship `browser-polyfill.js` to Chrome only (drop it from Firefox)

**Date:** 2026-06-14 (revised 2026-06-15 to approach 3c)
**Branch:** `firefox-drop-browser-polyfill` (off `master`)
**Idea note:** `idea/firefox-drop-browser-polyfill` branch holds the original parked note; its
"Update 2026-06-14" baseline seeded this design.

## Goal

Make `webextension-polyfill` (`browser-polyfill.js`) ship to the **Chrome** build only and be fully
absent from the **Firefox** build. Firefox implements `browser.*` natively, so the polyfill is
redundant there (~25 KB of dead weight + an extra parse/network step per page). This changes what
loads on Firefox, so it is a Firefox behavior change that must be verified by hand.

## Precondition (confirmed on `master`)

- esbuild migration present: `scripts/build.js`, the `BUILD_TARGET` `define`, per-target asset copy.
- `retire-vendor-postinstall` landed (commit `c274931`, #267): `src/ensure-browser-global.ts` exists
  and is imported **only** by `src/background.ts` (its first import); no polyfill import in
  `settings.ts`; UI bundles are already polyfill-free (UI pages get `browser` solely from the classic
  `<script src="../vendor/browser-polyfill.js">`).

Today the polyfill reaches the extension two independent ways: a copied `vendor/browser-polyfill.js`
asset referenced by a classic `<script>` in **8** static HTML pages, and a bundled
`import browserPolyfill from 'webextension-polyfill'` in `src/ensure-browser-global.ts` (with
`(globalThis as any).browser ??= browserPolyfill`) inlined into `background.js`.

## Approach: one shared external file (3c)

Rather than gate two mechanisms separately (the original 3a plan: `BUILD_TARGET`-gate the SW import +
strip the `<script>` from Firefox HTML), **unify the service worker and the UI on a single
mechanism** and drop HTML post-processing entirely.

### Key enabling fact (verified by reading `browser-polyfill.js`)

The polyfill's UMD wrapper:

```js
(function (global, factory) {
  if (typeof define === "function" && define.amd) { define(...) }
  else if (typeof exports !== "undefined") { factory(module); }    // bundled-as-CJS path
  else { var mod = {exports:{}}; factory(mod); global.browser = mod.exports; }  // global path
})(globalThis ?? self ?? this, function (module) {
  ...
  if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
    module.exports = wrapAPIs(chrome);     // old Chrome: build the wrapper
  } else {
    module.exports = globalThis.browser;   // modern Chrome / native: return existing browser
  }
});
```

- When esbuild **bundles** the npm package it CJS-wraps it, so `exports` is defined → middle branch →
  it never assigns the global. That is the *entire reason* `ensure-browser-global.ts` needed the
  manual `??=`.
- When the **verbatim file** is loaded as its own ES module, ESM scope has no `exports` → the `else`
  (global) branch runs → `globalThis.browser = …`. So a verbatim side-effect ESM import
  **self-installs `browser`**, exactly like today's classic `<script>`.
- On modern Chrome (and Firefox) the inner `else` returns the existing native `browser` — a
  deliberate no-op. Nothing to break; also nothing observable there (see Verification).

### Mechanism

1. **Ship one file, Chrome only.** Keep copying `vendor/browser-polyfill.js` from
   `node_modules/webextension-polyfill/dist/`, gated on `t === 'chrome'` (Change 1).
2. **`src/ensure-browser-global.ts` becomes a verbatim side-effect import** of that shipped file via
   an **extension-root-absolute** specifier, marked **external** so esbuild emits it as-is instead of
   inlining:

   ```ts
   import '/vendor/browser-polyfill.js';
   ```

   The npm `import browserPolyfill from 'webextension-polyfill'` and the `??=` are removed. The
   absolute `/vendor/…` specifier resolves to `chrome-extension://<id>/vendor/…` identically from
   entries at any directory depth (`dist/background.js` vs `dist/ui/*.js`) — esbuild does **not**
   rewrite external import paths, so one shared module must use a depth-independent specifier.
3. **Every entry imports `ensure-browser-global` first** so `browser` exists before any module in the
   graph evaluates. `background.ts` already does (`import './ensure-browser-global.js'`). The 7 UI
   entries (`src/ui/{popup,options,options-permissions,permissions,custom-format,check-custom-formats,built-in-style-options}.ts`)
   gain `import '../ensure-browser-global.js';` as their first line. (`offscreen.ts` uses only
   `chrome.*` and is left untouched.)
4. **Delete the classic `<script src="../vendor/browser-polyfill.js">`** from all 8 source HTML pages
   (both targets) — loading now happens via the entry's first import. No per-target HTML
   post-processing.
5. **esbuild per-target resolution** (a small `onResolve` plugin in `scripts/build.js`):
   - **Chrome:** resolve `/vendor/browser-polyfill.js` as `{ external: true }` → emitted verbatim;
     the browser loads/caches the single shared file.
   - **Firefox:** resolve it to `src/shims/empty.js` (`export {};`) → nothing imported, no bundle,
     no 404. Firefox uses its native `browser`.

   Because the polyfill is now **always external** on Chrome (never bundled), its code (`wrapAPIs`,
   etc.) appears only in `vendor/browser-polyfill.js`, never inlined in any bundle — and on Firefox it
   is absent entirely.

### Pages with no JS entry

`custom-format-help.html` and `about.html` reference only a dead `options-ui.js` (no such entry).
`custom-format-help.html` currently loads the polyfill via the classic `<script>` but has no working
JS that uses `browser`; under 3c it simply loses the tag. `about.html` has no polyfill `<script>` at
all — only the attribution `<h3>browser-polyfill.js (webextension-polyfill)</h3>` (kept).

## TypeScript

- Delete `src/types/webextension-polyfill.d.ts` (the `declare module 'webextension-polyfill'`) — the
  bare import is gone.
- Add `src/types/vendor-polyfill.d.ts`: `declare module '/vendor/browser-polyfill.js';` (a
  side-effect-only module, no exports) so `tsc` accepts the absolute specifier.
- `webextension-polyfill` stays a `devDependency` (it provides the copied file); no `package.json`
  change.

## Constraints / non-goals

- **Chrome behavior:** *functionally identical* — `browser` is installed before entry code (ESM
  evaluates the first import before the rest), from the **same single cached file**. The mechanism
  changes (HTML classic `<script>` → ESM external import in each entry); Chrome is therefore no longer
  byte-identical. This is the accepted cost of unifying on one mechanism and removing HTML
  post-processing.
- **Turndown / `BUILD_TARGET` converter exclusion:** not touched.
- **License attribution intact:** `about.html`'s attribution text stays for both targets; the
  Chrome-shipped `browser-polyfill.js` keeps its file header (copied verbatim). Only the `<script>`
  *load* is removed.
- **No normalization dependency:** Firefox's native `browser` is the reference implementation the
  polyfill emulates; nothing on Firefox relies on polyfill-specific behavior. Verified by the manual
  smoke test.
- **No dynamic import / no code splitting.** A `BUILD_TARGET`-gated `await import()` would break MV3's
  synchronous listener registration; code splitting would flip the deliberate `splitting:false` and
  restructure all outputs. Both rejected; the external-import + `onResolve` plugin keeps the SW a
  single synchronous-first-import module and leaves output structure unchanged.

## Verification (reframed for the modern-Chrome no-op)

On modern Chrome the polyfill **deliberately returns native `browser`** (the inner `else`), so
`typeof browser !== 'undefined'` proves nothing — a false-positive trap. Verification therefore
targets the two things that *can* fail, neither false-positive-prone:

1. **Resolution — loud-if-broken (modern Chrome smoke).** The polyfill import is the **first import of
   every entry**, so if `/vendor/browser-polyfill.js` failed to resolve, the whole entry module fails
   to load — popup blank, options dead, SW won't register, console error. A working popup/options +
   clean console + a registered service worker is therefore proof the absolute external import
   resolved in both the MV3 module SW and extension pages.
2. **Old-Chrome install path — deterministic, no old Chrome needed (vitest browser test).** Load the
   **verbatim** file as a real ES module in a plain Chromium page (which has *no* native `browser`),
   with `window.chrome` stubbed (`{runtime:{id}}`) and `window.browser` undefined, and assert the
   import installs a defined, wrapped `window.browser`. Plain pages have no native `browser`, so a
   pass means the *polyfill itself* installed it — false-positive-free, exercising the exact file we
   ship.

### Build-output assertions (deterministic, no browser)

- Firefox: `firefox-mv3/dist/vendor/browser-polyfill.js` absent; `bulma.css` present; no `wrapAPIs` in
  any `firefox-mv3/dist/**/*.js`; no `firefox-mv3/dist/**/*.js` contains `/vendor/browser-polyfill.js`;
  no `firefox-mv3/dist/static/*.html` contains `vendor/browser-polyfill.js`.
- Chrome: `chrome/dist/vendor/browser-polyfill.js` present and contains `wrapAPIs`; `wrapAPIs` is
  **not** present in `chrome/dist/background.js` or any `chrome/dist/ui/*.js` (proves not inlined);
  `chrome/dist/background.js` and each `chrome/dist/ui/<entry>.js` contain the string
  `/vendor/browser-polyfill.js` (the external import); no `chrome/dist/static/*.html` contains
  `vendor/browser-polyfill.js`.

### Acceptance

- The two build-output sets above hold; marker grep (`wrapAPIs`) over `firefox-mv3/dist/**` → 0.
- The vitest install-path test passes; the build-output test passes.
- `npm run typecheck`, `npm run lint`, `npm test` green; Chrome e2e green (Docker).
- **Chrome manually smoke-tested** (resolution loud-failure check): popup copy, options, no console
  error, SW registered.
- **Firefox build manually smoke-tested**: popup copy, options, permissions flow, selection→Markdown;
  no 404 for `browser-polyfill.js`.
- Short PR note.

## Commit plan (frequent commits)

1. vitest install-path test (pins the foundational ESM-install behavior).
2. Build-output lock test (red until the wiring lands).
3. Change 1 — asset copy gated on `t === 'chrome'`.
4. `ensure-browser-global.ts` → external verbatim import; esbuild `onResolve` plugin + `empty.js`
   shim; delete `webextension-polyfill.d.ts`, add `vendor-polyfill.d.ts`; verify bundle greps.
5. Wire the 7 UI entries + delete `<script>` from the 8 HTML pages; build-output test goes green.
6. Full verification: typecheck/lint/test, Chrome e2e, manual Chrome + Firefox smoke, PR note.
