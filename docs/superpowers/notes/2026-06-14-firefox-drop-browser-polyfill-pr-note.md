# Ship `browser-polyfill.js` to Chrome only

## What

`webextension-polyfill` (`browser-polyfill.js`) now ships to the **Chrome** build only and is fully
absent from the **Firefox** build. Firefox implements `browser.*` natively, so the polyfill was
redundant there (~25 KB of dead weight + an extra parse step per page).

## Why

The polyfill exists to give Chrome a Promise-based `browser.*` namespace on top of its callback-based
`chrome.*`. Firefox has `browser.*` natively, so on Firefox the polyfill was a runtime no-op. This
removes it from every Firefox artifact.

## How (approach 3c: one shared external file)

Instead of the previous dual wiring (a bundled npm import for the service worker **and** a classic
`<script>` per HTML page), the polyfill is now loaded **one way everywhere**: a verbatim,
side-effect ES-module import.

- `src/ensure-browser-global.ts` is now just `import '/vendor/browser-polyfill.js';`. Loaded as its
  own ES module, the polyfill's UMD wrapper self-installs `globalThis.browser` (ESM scope has no
  CommonJS `exports`, so it takes the global-assignment branch). The old `import … from
  'webextension-polyfill'` + `??=` is gone.
- Every entry imports it **first**: the service worker (`background.ts`, unchanged) and all 7 UI
  entries. This matters for correctness — `options.ts`/`options-permissions.ts` register
  `browser.*` listeners at module top level, so the global must exist before they evaluate.
- The classic `<script src="../vendor/browser-polyfill.js">` is removed from all 8 HTML pages.
- `scripts/build.js`:
  - copies `vendor/browser-polyfill.js` for **Chrome only** (gated like the existing `offscreen.html`
    exclusion);
  - an esbuild `onResolve` plugin keeps `/vendor/browser-polyfill.js` **external** on Chrome (emitted
    verbatim → one shared, browser-cached file, never inlined into a bundle) and **redirects it to an
    empty module** (`src/shims/empty.js`) on Firefox (nothing imported, no 404).
- The extension-root-absolute specifier `/vendor/browser-polyfill.js` resolves identically from
  entries at any directory depth (`dist/background.js` vs `dist/ui/*.js`); esbuild does not rewrite
  external import paths, so a depth-independent specifier is required.
- `src/types/webextension-polyfill.d.ts` (the old `declare module 'webextension-polyfill'`) is
  removed; `src/types/vendor-polyfill.d.ts` declares the new side-effect module for `tsc`.
- `vitest.config.ts` aliases `/vendor/browser-polyfill.js` → the empty shim per project, because
  tests resolve `src/**` through Vite (not the esbuild plugin); browser tests supply their own
  `browser` mock.

## Chrome impact

Functionally identical: `browser` is still installed before page code, from the **same single cached
file**. The mechanism changed (classic `<script>` → ESM external import in each entry), so the Chrome
output is no longer byte-identical, but the shipped polyfill file and its behavior are unchanged.
`webextension-polyfill` remains a `devDependency` (it provides the copied file).

## Attribution

`about.html`'s attribution for `browser-polyfill.js` is kept; the Chrome-shipped file keeps its
header (copied verbatim). Only the `<script>` *load* was removed.

## Verification

- New `test/build/no-polyfill-in-firefox.test.ts` (builds both targets): Firefox has no
  `vendor/browser-polyfill.js`, no `wrapAPIs` and no `/vendor/...` import in any JS, no HTML
  reference; Chrome ships the polyfill only in `vendor/browser-polyfill.js` (never inlined) with the
  external import in the SW + all 7 UI bundles; no HTML tags on either target.
- New `test/ui/polyfill-installs-browser.spec.ts`: loads the verbatim file as an ES module in a plain
  Chromium page (no native `browser`) and confirms it self-installs `window.browser` — proving the
  old-Chrome install path without needing an old Chrome (on modern Chrome the polyfill is a
  deliberate no-op, so it can't be observed there).
- `npm run typecheck`, `npm run lint`, `npm test` (35 files, 182 tests) green; Chrome e2e (Docker)
  green.
- **Manual smoke tests still pending** (require hands-on browser loading): Chrome
  popup/options/console/SW-registered (resolution check — the import is first, so a resolution
  failure would be loud), and Firefox popup copy / options / permissions flow / selection→Markdown
  with no `browser-polyfill.js` 404.
