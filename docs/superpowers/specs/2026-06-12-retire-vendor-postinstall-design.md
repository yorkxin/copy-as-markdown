# Retire `src/vendor/` + `scripts/postinstall.js` — Design

**Date:** 2026-06-12
**Status:** Approved — proceeding to implementation plan.
**Branch:** `retire-vendor-postinstall` (off `master`).
**Type:** Build / dependency-wiring refactor. **Runtime behavior must be identical.**

## Problem

`scripts/postinstall.js` copies five files out of `node_modules` into `src/vendor/` on every
`npm install`. Those copies are then re-exported through `src/shims/*.js` and imported by the TS
source, or referenced as physical assets by HTML. This made sense under the old `tsc + copy` build,
which had no bundler. With **esbuild** (current build, `scripts/build.js`) the bundler resolves and
inlines dependencies from `node_modules` natively, so the indirection layer is redundant and
introduces a committed-vs-installed **drift risk** (`src/vendor/*` is both committed and regenerated
by `postinstall`).

## Precondition (verified)

esbuild migration is present on `master`: `scripts/build.js` exists, there is no
`scripts/compile.js`, and `npm run build` produces `chrome/` + `firefox-mv3/`. Work is therefore
based on `master` (not the stale `idea/retire-vendor-postinstall` branch, which predates the
migration and still contains `compile.js`).

## Goal

Let esbuild resolve dependencies from `node_modules` instead of vendoring them. Remove
`src/vendor/`, `src/shims/`, and `scripts/postinstall.js`.

## Two categories of vendored files

### A. JS libraries esbuild bundles (turndown, turndown-plugin-gfm, mustache)

Imported by TS and inlined into entry bundles. Switch to package-name imports; delete the `.mjs`
copies and the re-export shims.

| Consumer | Today | After |
|---|---|---|
| `src/lib/html-to-markdown.ts` | `import TurndownService from '../shims/turndown.js'` | `import TurndownService from 'turndown'` |
| `src/lib/html-to-markdown.ts` | `import { tables } from '../shims/turndown-plugin-gfm.js'` | `import { tables } from '@truto/turndown-plugin-gfm'` |
| `src/lib/custom-format.ts` | `import Mustache from '../shims/mustache.js'` | `import Mustache from 'mustache'` |

**Turndown browser-build resolution (the one thing to get right).** Turndown ships a Node build
(uses `domino`, a server DOM) and a browser build (real DOM). The vendored file hard-coded the
browser one. `turndown`'s `package.json` encodes this in its `browser` field (verified):

```jsonc
"module":  "lib/turndown.es.js",
"browser": { "domino": false, "./lib/turndown.es.js": "./lib/turndown.browser.es.js", … }
```

esbuild honors that map under `platform:'browser'`, auto-selecting the browser build and stubbing
out `domino`. **`scripts/build.js` will set `platform:'browser'` explicitly** (today it relies on
the esbuild default) so this resolution is locked in rather than implicit. Plain `import 'turndown'`
then yields the same result the vendored path encoded.

Fallback only if the package-name import proves flaky (domino leaks): deep import
`turndown/lib/turndown.browser.es.js`, or an esbuild `alias`. Not expected to be needed.

**Types.** `@types/turndown` and `@types/mustache` (devDeps) cover turndown and mustache.
`@truto/turndown-plugin-gfm` **now ships its own types** (`lib/index.d.ts`, declared via the
package's `exports["."].types`), so a direct import type-resolves with no ambient `.d.ts`. The
current `src/shims/turndown-plugin-gfm.d.ts` already re-exports those package types, which is why
typecheck passes today. **Decision: rely on the package's own types; add no ambient declaration.**
A minimal ambient `.d.ts` is a verified fallback only — added solely if `npm run typecheck` fails
without it.

### B. Files referenced as physical assets by HTML (browser-polyfill.js, bulma.css)

Not bundled — `browser-polyfill.js` loads as a classic `<script src="../vendor/...">` and
`bulma.css` via `<link href="../vendor/...">`, so real files must exist in `dist/vendor/`.
`scripts/build.js` `copyAssets()` will copy them **straight from `node_modules`** (destination
path under `<target>/dist/vendor/` unchanged, so HTML refs need no edit):

- `node_modules/webextension-polyfill/dist/browser-polyfill.js` → `<target>/dist/vendor/browser-polyfill.js`
- `node_modules/bulma/css/bulma.css` → `<target>/dist/vendor/bulma.css`

`src/lib/settings.ts` also side-effect-imports the polyfill; change
`import '../vendor/browser-polyfill.js'` → `import 'webextension-polyfill'` (a real package esbuild
bundles into the entry). The dual-load (classic `<script>` in HTML + bundled module import in
settings) is preserved exactly as today — identical behavior.

Watch mode: drop the `fs.watch` on `src/vendor` (the assets now live in `node_modules`, which does
not change during development).

## What goes away vs. what stays

**Delete:**
- `scripts/postinstall.js` and the `postinstall` script in `package.json`.
- `src/vendor/` entirely: `turndown.mjs`, `turndown-plugin-gfm.mjs`, `mustache.mjs`,
  `browser-polyfill.js`, `bulma.css`, `README.md`, `.DS_Store`.
- `src/shims/` entirely: `turndown.js`, `turndown.d.ts`, `turndown-plugin-gfm.js`,
  `turndown-plugin-gfm.d.ts`, `mustache.js`, `mustache.d.ts`.

**Update:**
- `scripts/build.js`: re-source the two copied assets from `node_modules`; set
  `platform:'browser'`; drop the `src/vendor` watcher.
- `docs/build.md`: the asset-copy step (§"How it works" item 3) and any "vendored `.mjs` files are
  bundled" wording.
- `README.md`: vendor/third-party wording if present.

**Keep / not touched:**
- `BUILD_TARGET` mechanism and the markdown-converter dynamic-import exclusion — untouched.
- `scripts/assert-no-turndown.js` + `test/build/no-turndown-in-chrome-background.test.ts` — must
  stay green.
- License attribution: `src/static/about.html` remains the notice surface; esbuild
  `legalComments:'eof'` still preserves bundled banners; copied `browser-polyfill.js`/`bulma.css`
  keep their headers (still shipped as standalone files, just copied from `node_modules`).
- No minification.

## Critical constraint

Turndown must still use the real DOM, not `domino`. The Chrome `dist/offscreen.js` and Firefox
event-page conversion must keep working, `domino` must be in **no** bundle, and
`scripts/assert-no-turndown.js` must keep passing (Turndown absent from `chrome/dist/background.js`,
present in `chrome/dist/offscreen.js`).

## Verification gates

1. `npm run typecheck` — green (proves package types resolve with no shims).
2. `npm run build` — green; `assert-no-turndown.js` passes.
3. `domino` absent from every bundle: grep `chrome/dist/*.js` + `firefox-mv3/dist/*.js`. `domino`
   in none; `TurndownService` present in `chrome/dist/offscreen.js` and
   `firefox-mv3/dist/background.js`, absent from `chrome/dist/background.js`.
4. `npm run lint` — green.
5. `npm test` — green (includes the no-turndown build test).
6. `npm run test:e2e` (Chrome) — green (offscreen conversion verified end-to-end).
7. `npm ci` succeeds with no `postinstall` step and `src/vendor` not regenerated.

## Acceptance

`src/vendor/` and `scripts/postinstall.js` gone; all gates above green; no `domino` in any bundle;
offscreen + event-page Markdown conversion verified working; a short PR note documenting the new
dependency wiring.
