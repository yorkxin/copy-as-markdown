# Build

The extension is built with **esbuild**, once per target (`chrome` and `firefox-mv3`).

## Commands

- `npm run build` — build both `chrome/` and `firefox-mv3/`.
- `npm run build-chrome` — build Chrome, then assert Turndown is absent from the
  service-worker bundle (`scripts/assert-no-turndown.js`).
- `npm run build-firefox-mv3` — build Firefox.
- `npm run package` / `package-chrome` / `package-firefox-mv3` — build, then zip / `web-ext build`
  the store-uploadable artifact into `build/`.
- `npm run debug-chrome` / `debug-firefox-mv3` — esbuild `--watch` + `web-ext run`.
- `npm run typecheck` — `tsc --noEmit` (type-checking only; esbuild owns emit).
- `npm run lint` — eslint.
- `npm test` — vitest (`unit` + `browser` projects).
- `npm run test:e2e` — build the test extensions, then Playwright against real Chrome.

## How it works

`scripts/build.js <chrome|firefox-mv3>`:

1. Removes the target's `dist/` (esbuild does not clean stale files), then recreates it and the
   tracked `.keep` placeholder.
2. Bundles each entry point (`bundle:true`, `format:'esm'`, `splitting:false`) into one
   self-contained file per entry under `<target>/dist`, preserving the entry directory layout
   (`outbase:'src'`). Non-entry modules are inlined, not emitted separately, so `dist/` has far
   fewer files than the entry count's worth of imports — shared modules are duplicated into each
   entry bundle (the cost of `splitting:false`, which MV3 service workers require).
3. Copies assets that HTML/manifest reference verbatim: `src/static/**`,
   `src/vendor/browser-polyfill.js`, `src/vendor/bulma.css`. The vendored `turndown`, `gfm`, and
   `mustache` `.mjs` files are **bundled** (not copied) into the entries that import them.

The entry points are listed in `entryPointsFor()` in `scripts/build.js`: `background` + the seven
UI page scripts for both targets, plus `offscreen` for Chrome only (Firefox has no offscreen API).

## Compile-time target flag (`BUILD_TARGET`)

esbuild injects `define: { BUILD_TARGET }` (`'chrome'` | `'firefox-mv3'`), declared ambiently in
`src/types/build-target.d.ts`. Code branches on `BUILD_TARGET === 'firefox-mv3'`; on the other
target that comparison constant-folds to `false` and the branch is dead-code-eliminated. This
replaces the old runtime mechanism (`firefox-mv3/hacks.js` globals read via `src/config/flags.ts`),
which has been removed.

### Keeping Turndown out of the Chrome service worker

The DOM-only Turndown library (via `src/lib/html-to-markdown.ts`) must be **absent from
`chrome/dist/background.js`** (the MV3 service worker has no DOM) but **present in
`chrome/dist/offscreen.js`** (the Chrome conversion path). That is a **per-entry** requirement, so
a target-global `define`/`alias`/stub cannot express it.

The mechanism:

- `src/offscreen.ts` imports `html-to-markdown` **statically** → Turndown is in `offscreen.js`.
- `src/services/markdown-converter.ts` (`createEventPageMarkdownConverter`, the Firefox path)
  imports it via a **dynamic `import()`**, keeping it out of `background.ts`'s static graph. On
  Chrome, `BUILD_TARGET` DCE additionally drops that converter entirely.

This invariant is **enforced** (not hand-maintained):

- `scripts/assert-no-turndown.js` fails `build-chrome` if `chrome/dist/background.js` contains
  `TurndownService`.
- `test/build/no-turndown-in-chrome-background.test.ts` checks the same under `npm test`.

If you ever refactor the converter, do **not** hoist the dynamic import to a static one — it will
re-introduce Turndown into the service-worker bundle and the assertion/test will fail.

## Source maps & minification

Builds emit linked source maps with embedded sources (`sourcemap:'linked'`, `sourcesContent:true`),
so DevTools shows the original `src/*.ts` files for breakpoints in both service-worker and page
contexts. Output is **never minified** (readable source, simple maps).

## Third-party licenses

`legalComments:'eof'` preserves bundled libraries' `/*!` / `@license` banners at the end of each
output file. `src/static/about.html` is the authoritative attribution surface and lists all five
bundled libraries (Bulma, Turndown.js, turndown-plugin-gfm, browser-polyfill, mustache.js) with
their license texts; `browser-polyfill.js` and `bulma.css` also ship as standalone copied files
with their headers intact.

## Adding a new entry point

1. Add the script path to `sharedEntries` (or the Chrome-only branch) in `scripts/build.js`'s
   `entryPointsFor()`.
2. Create the HTML page under `src/static/` that loads it via
   `<script type="module" src="../<path>.js">` (and `../vendor/browser-polyfill.js` if it needs the
   `browser` global). `src/static/**` is copied automatically.
3. If the page is Chrome- or Firefox-only, gate it in `entryPointsFor()` and/or the `copyAssets()`
   filter the way `offscreen` is.

> Note: a helper module imported by an existing entry does **not** need to be listed — esbuild
> bundles it into that entry. Only scripts loaded directly by HTML or the manifest are entry points.
