# Design: esbuild compile-time build flags (BUILD_TARGET)

**Date:** 2026-06-07
**Status:** Approved design — ready for implementation plan
**Branch base:** `master` (this branch is `master` + the parked idea note)
**Related (out of scope):** `docs/superpowers/ideas/clipboard-service-interface.md`

## Problem

The extension ships **byte-identical JS to Chrome and Firefox** and differentiates the two
targets purely at *runtime*: `firefox-mv3/hacks.js` injects globals that `src/config/flags.ts`
reads. There is no bundler — `tsc` emits `src/ → dist/` 1:1, then `scripts/compile.js <target>`
copies the same `dist/` (+ `src/vendor`, `src/static`) into `chrome/dist` and `firefox-mv3/dist`.

Consequence: **no module can be excluded from one target.** Everything reachable from an entry
point ships to both browsers. The Chrome MV3 service worker has no DOM, yet a DOM-only module
(Turndown, via `src/lib/html-to-markdown.ts`) sits one hop away in `background.ts`'s import
graph. Today the only thing keeping Turndown out of the Chrome service worker is a hand-
maintained **lazy `import()`** in `src/services/markdown-converter.ts` plus ⚠️ safety comments —
*detection/discipline, not exclusion*.

## Goal

Adopt **esbuild** to produce **two builds** that branch at **compile time** on a per-target
`BUILD_TARGET` define. Dead-code elimination + tree-shaking then **physically exclude** target-
specific modules from the other target's output — the JS equivalent of Go build tags. Motivating
case: keep the DOM-only Turndown module structurally out of the Chrome MV3 service-worker bundle,
enforced by an automated check rather than by convention.

This is a **build refactor only**. Runtime behavior must be identical in both browsers.

## Scope

**In scope**
- esbuild-based per-target build (`scripts/build.js <chrome|firefox-mv3>`), replacing
  `tsc emit → compile.js copy`.
- `BUILD_TARGET` define + ambient `declare const BUILD_TARGET`.
- Migrate the two target-differentiating runtime flags to `BUILD_TARGET` branches, starting with
  the markdown-converter selection (so Turndown is tree-shaken out of Chrome).
- Wire vendor/static asset copying; per-target entry lists.
- Update `package.json` scripts (`compile`, `compile-chrome`, `compile-firefox-mv3`, debug, e2e
  build) and the debug/watch workflow.
- An automated assertion proving Turndown is absent from the Chrome background bundle.
- A short PR note: the new build + how to add a new entry point.

**Out of scope / non-goals**
- The ClipboardService interface refactor (separate idea/PR).
- Any change to extension feature behavior.
- Minification (intentionally **not** adopted — see §6). The mock-clipboard runtime mechanism is
  left untouched.

## Constraints

- After migration, Turndown must be **provably absent** from the Chrome background bundle,
  enforced by a check (replaces #259's hand-maintained safety comments + manual reasoning).
- All existing checks stay green: `npm run typecheck`, `npm run lint`, `npm test` (vitest unit +
  browser), and `npm run test:e2e` (Chrome). Known flaky parallel-clipboard e2e test — re-run in
  isolation if it trips.
- Source maps and the debug/watch workflow must keep working (re-validate).
- `tsc` is retained for **type-checking only** (`tsc --noEmit`); it no longer emits.
- MV3 service-worker constraint: no code-splitting / dynamic-chunk loading for the SW entry —
  one output file per entry (`splitting: false`).

---

## Architecture

### 1. Build pipeline — `scripts/build.js <target>`

A single script, run once per target (`chrome` | `firefox-mv3`), performs three steps:

**Step A — Clean (esbuild does NOT clean for us).** esbuild overwrites the files it emits but
leaves stale/removed files behind. The build step must therefore start by removing the target's
output dir: `rm -rf <target>/dist`. This guarantees deterministic output — no orphaned files when
an entry is removed or when we stop copying the vendored `.mjs` shims. (The existing `cpSync`-based
`compile.js` had this same gap and relied on a separate `npm run clean`; the new build is
self-cleaning per target.)

**Step B — esbuild bundle.** Bundle the per-target JS entry points:

```js
await esbuild.build({
  entryPoints: entryPointsFor(target), // see §2
  bundle: true,
  format: 'esm',
  splitting: false,            // MV3 service worker: one file per entry, no chunks
  treeShaking: true,
  outdir: `${target}/dist`,
  outbase: 'src',              // preserve entry directory layout under dist/
  sourcemap: 'linked',         // emit .js.map + sourceMappingURL comment (see §5)
  sourcesContent: true,        // embed original TS in the map (DevTools shows real source)
  minify: false,               // never minify (see §6)
  legalComments: 'eof',        // preserve bundled libs' license banners (see §6.1)
  define: { BUILD_TARGET: JSON.stringify(target) },
  target: ['chrome116', 'firefox139'], // match manifest minimums (illustrative; tune in impl)
  logLevel: 'info',
});
```

**Bundle-per-entry semantics (important difference from `tsc`):** with `bundle:true`, each
**entry point** becomes **one self-contained output file** with all transitively-imported modules
*inlined*. Non-entry modules (`lib/`, `services/`, `handlers/`, `contracts/`, vendored `.mjs`) do
**not** appear as separate files — they are bundled into the entries that use them. `outbase:'src'`
preserves the **entry** directory layout, so:

- `src/background.ts → <target>/dist/background.js`
- `src/offscreen.ts → <target>/dist/offscreen.js` (Chrome only)
- `src/ui/popup.ts → <target>/dist/ui/popup.js` (etc.)

This keeps the HTML `<script src="../ui/popup.js">` and `service_worker: "./dist/background.js"`
paths working unchanged. Two consequences:
- `dist/` has **far fewer files** than today (entries + copied assets only).
- Shared modules are **duplicated** into each entry bundle — the accepted cost of `splitting:false`
  (required by MV3 SW). Output size is still small; source maps keep it debuggable.

**Step C — Asset copy.** Copy non-bundled assets the manifests/HTML reference by path:
- `src/static/**` → `<target>/dist/static/` (HTML, `style.css`, `images/`).
- `src/vendor/browser-polyfill.js` → `<target>/dist/vendor/browser-polyfill.js`
  (loaded as a classic `<script>` tag in every HTML page; must stay a standalone file).
- `src/vendor/bulma.css` → `<target>/dist/vendor/bulma.css` (HTML `<link>`).
- The vendored `turndown.mjs`, `turndown-plugin-gfm.mjs`, `mustache.mjs` are **no longer copied** —
  esbuild bundles them into the entries that import them (via the `src/shims/*.js` re-export shims).

> Note: `src/lib/settings.ts` also does a side-effect `import '../vendor/browser-polyfill.js'`, so
> the polyfill is additionally bundled into JS entries. This mirrors today's behavior (HTML loads
> it as a classic script *and* it's in the module graph) and is preserved as-is — no behavior change.

### 2. Per-target entry lists

`entryPointsFor(target)` returns:

**Both targets:**
- `src/background.ts`
- HTML-page scripts: `src/ui/popup.ts`, `src/ui/options.ts`, `src/ui/options-permissions.ts`,
  `src/ui/permissions.ts`, `src/ui/custom-format.ts`, `src/ui/check-custom-formats.ts`,
  `src/ui/built-in-style-options.ts`, `src/ui/options-ui.ts`

  (Enumerated from the `<script type="module" src="../ui/*.js">` references across
  `src/static/*.html`. The exact list is reconciled against those HTML refs during implementation
  — the entry list must match every UI script the static HTML loads.)

**Chrome only:**
- `src/offscreen.ts` (Firefox has no offscreen API)
- `src/static/offscreen.html` is copied for **Chrome only**. The Firefox build ships neither
  `offscreen.js` (not in its entry list) nor `offscreen.html` (excluded from the static copy on
  Firefox via a per-target filter in Step C).

Chrome-only service modules (`offscreen-document-service`, `offscreen-clipboard-service`) are not
listed as entries; they're reached only from `background.ts`, where the `BUILD_TARGET` branch
(§3) DCE-drops them from the Firefox background bundle.

### 3. BUILD_TARGET define + compile-time branching

- **Ambient declaration:** new `src/types/build-target.d.ts`:
  ```ts
  declare const BUILD_TARGET: 'chrome' | 'firefox-mv3';
  ```
  Ensures `tsc --noEmit` type-checks `BUILD_TARGET` usages. The actual value is substituted by
  esbuild's `define` at build time.

- **`background.ts`:** replace the runtime flag reads with compile-time branches:
  - `Flags.alwaysUseNavigatorClipboard()` → `BUILD_TARGET === 'firefox-mv3'`
  - `Flags.convertMarkdownInBackground()` → `BUILD_TARGET === 'firefox-mv3'`

  The converter selection becomes:
  ```ts
  const markdownConverter: MarkdownConverter = BUILD_TARGET === 'firefox-mv3'
    ? createEventPageMarkdownConverter()
    : createOffscreenMarkdownConverter(offscreenDocumentService!);
  ```
  On Chrome, `define`→constant-fold→DCE removes the `firefox-mv3` branch; tree-shaking then drops
  `createEventPageMarkdownConverter`, its `html-to-markdown` import, and Turndown. (DCE chain:
  `define` substitutes `BUILD_TARGET`; the literal comparison folds to a constant; the dead branch
  is eliminated; the now-orphaned imports are tree-shaken.)

- **`markdown-converter.ts`:** `createEventPageMarkdownConverter` switches from the lazy
  `import('../lib/html-to-markdown.js')` to a **normal static** `import { htmlToMarkdown } from
  '../lib/html-to-markdown.js'`. The lazy-import crutch and its ⚠️ "KEEP THIS DYNAMIC" comments
  are **removed**; a short comment replaces them, pointing at the §4 absence check as the now-
  authoritative guarantee. The ⚠️ header in `html-to-markdown.ts` is updated to reference the
  compile-time exclusion + check rather than the dynamic-import discipline.

  > Fallback (only if needed): if esbuild tree-shaking does not fully drop Turndown from the
  > Chrome bundle (e.g. a vendored module is treated as having load-time side effects), add an
  > esbuild `alias` mapping `./lib/html-to-markdown` to a no-op stub in the Chrome build. The §4
  > check decides whether this fallback is required — the primary mechanism is pure DCE/tree-shake.

- **Delete:** `src/config/flags.ts`, `firefox-mv3/hacks.js`, and the `"hacks.js"` entry from
  `firefox-mv3/manifest.json`'s `background.scripts`. (Note: `PERIDOCIALLY_REFRESH_MENU` was
  already removed on `master` in #263, so only the two target flags remain to migrate.)
  After deletion, `firefox-mv3/manifest.json` `background` becomes
  `{ "scripts": ["./dist/background.js"], "type": "module" }`.

- **Keep (runtime, not target):** the mock-clipboard mechanism — `setMockClipboardMode` global,
  `set-mock-clipboard` / `check-mock-clipboard` messages, and the `mockMode` plumbing in
  `clipboard-service.ts`. These are genuine runtime toggles for E2E, not target differentiators.

### 4. Provable absence of Turndown in the Chrome background bundle

Two enforcement points (both cheap; belt-and-suspenders):

- **Build step:** `scripts/assert-no-turndown.js` reads `chrome/dist/background.js` and exits
  non-zero if it matches a Turndown sentinel (`/turndown/i` and/or the `TurndownService`
  identifier). Wired into `compile-chrome` so a leaky build fails immediately.
- **Vitest unit test:** `test/build/no-turndown-in-chrome-background.test.ts` reads the built
  `chrome/dist/background.js` and asserts the same sentinels are absent, so `npm test` covers the
  invariant. (The test requires a Chrome build to exist; it documents/guards that precondition —
  e.g. skips with a clear message if the artifact is missing, and CI runs compile before test.)

The sentinel strings are chosen to be specific to Turndown (avoiding false positives from unrelated
words). Exact patterns finalized in implementation against the real bundle output.

### 5. Source maps & debugging (DevTools shows original `.ts`)

esbuild config must be tweaked so the debugging experience matches today's "navigate by source
filename":

- `sourcemap: 'linked'` — emit a `<entry>.js.map` next to each bundle with a
  `//# sourceMappingURL=` comment. DevTools (Chrome SW devtools and page devtools; Firefox
  debugger) reads the map and reconstructs the original `src/` tree, so breakpoints are set in
  `src/background.ts`, `src/lib/settings.ts`, etc. by their original paths/names, and stack traces
  resolve to `src/*.ts` line numbers.
- `sourcesContent: true` (esbuild default, set explicitly) — embed the original TS text in the map
  so DevTools shows real source even though the `.ts` files are not served by the extension.
- The watch/debug workflow regenerates the bundle **and** its `.map` on every save, keeping
  breakpoints accurate.

This is the only DX change: "open the raw built file and read it" becomes "use the Sources
tree / source map" — the normal bundled-extension workflow. Breakpoint-driven debugging is
otherwise unchanged.

### 6. No minification (deliberate)

Production builds are **not** minified. The current build ships unminified, and the maintainer is
fine with users reading the TS source in DevTools. Keeping `minify: false` also makes the raw
bundle readable and the source maps simpler/accurate. Minified release zips can be a separate
opt-in later if ever wanted; not part of this work.

### 6.1 Third-party license handling

Bundling inlines third-party libs into entry files, which can silently strip the attribution that
today's standalone `dist/vendor/*` files carry. The bundled libs are MIT (turndown,
turndown-plugin-gfm, mustache, bulma) and **MPL-2.0** (browser-polyfill); MIT requires the
copyright + license notice to travel with copies, MPL adds notice/source obligations. Two
safeguards:

- **`legalComments: 'eof'`** in the esbuild config (§1 Step B). esbuild collects every `/*!` and
  `@license` banner from bundled sources and moves it to the end of each output file, so marked
  notices are preserved rather than dropped. (`mustache.mjs` carries a `/*!` banner;
  `turndown.mjs` / `turndown-plugin-gfm.mjs` currently have no marker — see the note below.)
- **`src/static/about.html` remains the authoritative notice surface.** It already embeds full
  license texts (MPL-2.0 for browser-polyfill, MIT for the others) and ships in every build, which
  is what actually discharges the "include the notice" requirement regardless of bundling. The
  migration **verifies `about.html` lists all five bundled libs** (turndown, turndown-plugin-gfm,
  mustache, bulma, browser-polyfill) with their license text, and adds any that are missing.

What does **not** change: `browser-polyfill.js` (MPL) and `bulma.css` stay standalone copied files
(§1 Step C), so their headers survive untouched. This subsection is hygiene to prevent a *quiet
regression* of attribution that exists today — it does not change the extension's compliance
posture, which already rests on `about.html`.

> Out of scope (offered as belt-and-suspenders, deferred): vendoring each dep's `LICENSE` file via
> `scripts/postinstall.js`. Not required given `about.html`; can be a follow-up if desired.

### 7. package.json scripts & debug/watch

**CI dependency (must keep working):** `.github/workflows/nodejs.yml` calls `lint`, `test:unit`,
`test:browser`, `build-chrome`, `build-firefox-mv3`, and `test:e2e`. These stay; only their
underlying implementation changes.

**Migration-driven changes:**
- `compile-chrome` → `node scripts/build.js chrome`
- `compile-firefox-mv3` → `node scripts/build.js firefox-mv3`
- `compile` → `npm run compile-chrome && npm run compile-firefox-mv3` (drop the `build:ts &&`
  prefix; emit is owned by esbuild)
- `build:ts` (the old `tsc` emit script) → **removed**. `typecheck` (`tsc --noEmit`) stays.
- `scripts/compile.js` (file) → **deleted**, replaced by `scripts/build.js`.
- Top-level `./dist/` no longer exists (esbuild writes straight to `<target>/dist`). Consequences:
  - tsconfig `outDir: "./dist"` is vestigial under `--noEmit` → removed (or left harmless; remove
    for clarity).
  - `clean` → drop the dead `./dist/*` segment. `build.js` self-cleans `<target>/dist` per build
    (§1 Step A), so `clean` is now mainly for `build/` and the e2e test dirs.
- **Debug/watch:** replace the nodemon-watch-`compile.js` loop in `scripts/debug.js` with
  esbuild's native `context().watch()` (e.g. `node scripts/build.js <target> --watch`), keeping
  the existing `web-ext run` spawn + crash handling. The `nodemon` devDependency is removed.
  Asset copy (Step C) is re-run on rebuild (or watched) so static/vendor changes propagate.

**Approved script cleanups (beyond the migration):**
- **Consolidate the e2e variants.** Add `test:e2e:build` = `npm run compile && node
  scripts/build-test-extension.js`, and rewrite `test:e2e`, `test:e2e:headed`, `test:e2e:ui`,
  `test:e2e:debug` to `npm run test:e2e:build && playwright test [flag]`. Removes the repeated
  build prefix; all four variants stay. (CI calls `test:e2e`, so its behavior is unchanged.)
- **Remove `test:all`** (`npm test && npm run test:e2e`) — unused convenience wrapper.

**Intentionally kept:** `test`, `test:watch`, `test:ui`, `test:unit`, `test:browser`,
`debug-chrome`, `debug-edge`, `debug-firefox-mv3`, `debug-firefox-deved`, `test:e2e:docker`,
`bump-version`, `convert-images`, `postinstall` (still vendors libs into `src/vendor`), `clean`,
`lint`, `lint:fix`, `typecheck`.

### 8. PR note / docs

A short note (in the PR description and/or `docs/`) covering:
- The new build model (per-target esbuild, `BUILD_TARGET`, DCE, bundle-per-entry, self-cleaning,
  source maps, no minify).
- **How to add a new entry point:** add the script to `entryPointsFor()` (and to the per-target
  list if target-specific), create the HTML that loads `./<path>.js`, and — if it's a new HTML
  page — ensure `src/static` copying covers it.

---

## Migration order (parity-first)

Per the design note's sketch, port and validate incrementally:

1. Add `esbuild` devDependency; scaffold `scripts/build.js <target>` (clean + bundle + copy) and
   the `BUILD_TARGET` define + `src/types/build-target.d.ts`.
2. **Port `background.ts` first**, then validate **parity** against the current `tsc`+copy output.
   Because esbuild bundles per entry (one packed file, not a 1:1 mirror), parity is verified by
   **behavioral/load checks**, not a byte/file-by-file diff: the built `chrome` and `firefox-mv3`
   background scripts load without error, conversion + clipboard paths still work, and the expected
   `dist/` files are present. (A raw diff is not meaningful given inlining.)
3. Migrate remaining entries (offscreen, UI pages); wire per-target entry lists + asset copy.
4. Convert the converter selection (and the two target flags) to `BUILD_TARGET`; remove the lazy
   import; delete `flags.ts` + `hacks.js` + the manifest `hacks.js` reference.
5. Add the §4 absence check (build script + vitest test); confirm Turndown is gone from
   `chrome/dist/background.js`. Apply the alias fallback only if the check shows a leak.
6. Swap debug/watch to esbuild native watch; remove `nodemon`.
6a. Set `legalComments: 'eof'` (§6.1) and verify `about.html` lists all five bundled libs with
    their license text; add any missing entries.
6b. Finalize `package.json` scripts per §7: delete `build:ts`, `scripts/compile.js`, `test:all`;
    simplify `compile`; remove the dead `./dist/*` from `clean` and the vestigial tsconfig
    `outDir`; add `test:e2e:build` and route the four `test:e2e*` variants through it.
7. Re-validate: `typecheck`, `lint`, `npm test` (unit + browser), `npm run test:e2e` (Chrome).
   Re-run the flaky parallel-clipboard e2e in isolation if it trips.
8. Write the PR note (§8).

## Acceptance criteria

- `npm run compile` produces working `chrome/` and `firefox-mv3/` builds via esbuild with
  per-target `BUILD_TARGET`.
- Chrome background bundle provably excludes Turndown (DOM-only) modules, enforced by the §4 check.
- `typecheck`, `lint`, `npm test`, and Chrome e2e all green.
- `hacks.js` target-globals and the corresponding `Flags` accessors removed; `src/config/flags.ts`
  deleted; mock-clipboard runtime mode documented as intentionally kept.
- `markdown-converter.ts` no longer needs the lazy dynamic import (BUILD_TARGET branch handles it).
- Source maps work: breakpoints in original `src/*.ts` via DevTools, in SW and page contexts.
- Third-party license attribution preserved: `legalComments: 'eof'` set, and `about.html` covers
  all five bundled libs (§6.1).
- A short PR note describing the new build and how to add a new entry point.

## Risks / open items (resolved during impl)

- **Tree-shaking leak:** if esbuild keeps Turndown in the Chrome bundle due to perceived module
  side effects, fall back to the Chrome `alias`→stub for `html-to-markdown` (§3). The §4 check is
  the decider.
- **Entry-list drift:** the UI entry list must exactly match the `<script>` refs in `src/static/*`;
  reconcile during impl (step 3).
- **`target:` versions** in esbuild are illustrative here; tune to the manifest minimums
  (`minimum_chrome_version: 116`, Firefox `strict_min_version: 139.0`) so output syntax is
  compatible without over-down-leveling.
- **e2e build-test-extension.js** consumes `chrome/` and `firefox-mv3/`; it should keep working
  unchanged since output paths are preserved, but re-validate after the entry/asset wiring.
