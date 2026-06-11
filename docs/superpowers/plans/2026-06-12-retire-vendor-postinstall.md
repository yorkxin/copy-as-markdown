# Retire `src/vendor/` + `scripts/postinstall.js` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let esbuild resolve turndown/turndown-plugin-gfm/mustache from `node_modules` and copy browser-polyfill/bulma from `node_modules` at build time, then delete `src/vendor/`, `src/shims/`, and `scripts/postinstall.js` — with identical runtime behavior.

**Architecture:** Replace shim/vendor imports with direct package-name imports (esbuild bundles them). Set esbuild `platform:'browser'` so turndown's `browser` field selects its real-DOM build and stubs `domino`. Re-source the two physical-asset copies (browser-polyfill.js, bulma.css) in `scripts/build.js` from `node_modules` instead of `src/vendor`. Preserve the per-entry Turndown-exclusion invariant (Turndown absent from `chrome/dist/background.js`, present in `chrome/dist/offscreen.js`).

**Tech Stack:** esbuild 0.28, TypeScript (tsc --noEmit for typecheck), vitest, Playwright, Node ESM build scripts.

**Spec:** `docs/superpowers/specs/2026-06-12-retire-vendor-postinstall-design.md`

---

## File Structure

**Modify:**
- `scripts/build.js` — set `platform:'browser'`; re-source asset copies from `node_modules`; drop the `src/vendor` watcher.
- `src/lib/html-to-markdown.ts` — import turndown + gfm from package names.
- `src/lib/custom-format.ts` — import mustache from package name.
- `src/lib/settings.ts` — `import 'webextension-polyfill'`.
- `package.json` — remove the `postinstall` script.
- `docs/build.md` — update the asset-copy description.
- `README.md` — update vendor/third-party wording if present.

**Delete:**
- `scripts/postinstall.js`
- `src/shims/` (turndown.js, turndown.d.ts, turndown-plugin-gfm.js, turndown-plugin-gfm.d.ts, mustache.js, mustache.d.ts)
- `src/vendor/` (turndown.mjs, turndown-plugin-gfm.mjs, mustache.mjs, browser-polyfill.js, bulma.css, README.md, .DS_Store)

**Not touched:** `BUILD_TARGET`, `src/services/markdown-converter.ts` dynamic-import exclusion, `scripts/assert-no-turndown.js`, `test/build/no-turndown-in-chrome-background.test.ts`, `src/static/*.html` (dist asset paths unchanged).

---

## Task 1: Set esbuild `platform:'browser'` (lock in turndown browser-build resolution)

Do this first and independently, so the build-config change is isolated and verifiable before any import is rewired.

**Files:**
- Modify: `scripts/build.js` (the `buildOptions` object, around line 63-78)

- [ ] **Step 1: Add `platform:'browser'` to `buildOptions`**

In `scripts/build.js`, inside the `buildOptions` object, add the `platform` field. Place it right after `bundle: true,`:

```js
const buildOptions = {
  entryPoints: entryPointsFor(target),
  bundle: true,
  platform: 'browser', // honor turndown's `browser` field: real-DOM build, domino stubbed out
  format: 'esm',
  splitting: false, // MV3 service worker: one file per entry, no chunks
  treeShaking: true,
  outdir,
  outbase: srcDir, // preserve entry directory layout under dist/
  sourcemap: 'linked', // emit .js.map + sourceMappingURL (DevTools breakpoints)
  sourcesContent: true, // embed original TS in the map
  minify: false, // never minify (readable source, simple maps)
  legalComments: 'eof', // preserve bundled libs' /*! and @license banners
  define: { BUILD_TARGET: JSON.stringify(target) },
  target: target === 'chrome' ? ['chrome116'] : ['firefox139'],
  logLevel: 'info',
};
```

- [ ] **Step 2: Verify the build still succeeds and the no-turndown assertion passes**

Run: `npm run build-chrome`
Expected: esbuild logs the chrome build, then `✓ chrome/dist/background.js is free of Turndown`. No errors. (At this point imports still go through the shims/vendor, so behavior is unchanged; this step only proves `platform:'browser'` doesn't regress the current build.)

- [ ] **Step 3: Commit**

```bash
git add scripts/build.js
git commit -m "build: set esbuild platform:'browser' explicitly

Locks in turndown's browser-field resolution (real-DOM build, domino
stubbed) ahead of switching to package-name imports.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Switch turndown + gfm imports to package names

**Files:**
- Modify: `src/lib/html-to-markdown.ts:18-19`

- [ ] **Step 1: Rewrite the two runtime imports**

In `src/lib/html-to-markdown.ts`, replace the shim imports (lines 18-19):

```ts
import TurndownService from '../shims/turndown.js';
import { tables } from '../shims/turndown-plugin-gfm.js';
```

with direct package-name imports:

```ts
import TurndownService from 'turndown';
import { tables } from '@truto/turndown-plugin-gfm';
```

Leave the `import type { Rule, Options as TurndownOptions } from 'turndown';` line (line 17) and the service-worker-safety comment (lines 1-16) exactly as they are.

- [ ] **Step 2: Typecheck (proves package types resolve with no shims)**

Run: `npm run typecheck`
Expected: PASS, no errors. This proves `@types/turndown` and `@truto/turndown-plugin-gfm`'s own `lib/index.d.ts` types resolve without the deleted `.d.ts` shims.

> If — and only if — typecheck reports that `@truto/turndown-plugin-gfm` has no types, add a minimal ambient declaration at `src/types/turndown-plugin-gfm.d.ts`:
> ```ts
> declare module '@truto/turndown-plugin-gfm' {
>   import type TurndownService from 'turndown';
>   export const tables: TurndownService.Plugin;
>   export const gfm: TurndownService.Plugin;
>   export const strikethrough: TurndownService.Plugin;
>   export const taskListItems: TurndownService.Plugin;
>   export const highlightedCodeBlock: TurndownService.Plugin;
> }
> ```
> Per the spec this is a verified fallback only — do not add it unless the typecheck above fails.

- [ ] **Step 3: Build Chrome and verify Turndown placement + no domino**

Run:
```bash
npm run build-chrome
grep -l TurndownService chrome/dist/offscreen.js
grep -L TurndownService chrome/dist/background.js
grep -rl domino chrome/dist/ ; echo "domino-grep-exit:$?"
```
Expected:
- `✓ chrome/dist/background.js is free of Turndown` from the assert script.
- `grep -l TurndownService chrome/dist/offscreen.js` prints `chrome/dist/offscreen.js` (Turndown present there).
- `grep -L TurndownService chrome/dist/background.js` prints `chrome/dist/background.js` (Turndown absent).
- The domino grep prints `domino-grep-exit:1` and lists no files (grep exits 1 when no match → no domino in any chrome bundle).

- [ ] **Step 4: Build Firefox and verify no domino**

Run:
```bash
npm run build-firefox-mv3
grep -rl domino firefox-mv3/dist/ ; echo "domino-grep-exit:$?"
grep -l TurndownService firefox-mv3/dist/background.js
```
Expected: `domino-grep-exit:1` with no files listed; `grep -l` prints `firefox-mv3/dist/background.js` (Firefox converts in the event page, so Turndown belongs in its background bundle).

- [ ] **Step 5: Commit**

```bash
git add src/lib/html-to-markdown.ts
git commit -m "refactor: import turndown + gfm from package names

esbuild resolves both from node_modules; platform:'browser' selects
turndown's real-DOM build (no domino). Drops the src/shims indirection
for these two libs.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Switch mustache import to package name

**Files:**
- Modify: `src/lib/custom-format.ts:1`

- [ ] **Step 1: Rewrite the import**

In `src/lib/custom-format.ts`, replace line 1:

```ts
import Mustache from '../shims/mustache.js';
```

with:

```ts
import Mustache from 'mustache';
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (uses `@types/mustache`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/custom-format.ts
git commit -m "refactor: import mustache from package name

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Switch settings.ts to the webextension-polyfill package

**Files:**
- Modify: `src/lib/settings.ts:1`

- [ ] **Step 1: Rewrite the side-effect import**

In `src/lib/settings.ts`, replace line 1:

```ts
import '../vendor/browser-polyfill.js';
```

with:

```ts
import 'webextension-polyfill';
```

This bundles the polyfill into each entry that imports settings (same side effect — sets `globalThis.browser`). The classic `<script src="../vendor/browser-polyfill.js">` in the HTML pages is unchanged and still loads first; the dual-load behavior is identical to today.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings.ts
git commit -m "refactor: import webextension-polyfill package in settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Re-source asset copies from `node_modules` and drop the vendor watcher

**Files:**
- Modify: `scripts/build.js` — `copyAssets()` (around line 47-61) and the watch block (around line 113-114)

- [ ] **Step 1: Re-source the two copied assets in `copyAssets()`**

In `scripts/build.js`, replace the asset-copy block inside `copyAssets(t)`:

```js
  const vendorDest = path.join(outdir, 'vendor');
  fs.mkdirSync(vendorDest, { recursive: true });
  for (const file of ['browser-polyfill.js', 'bulma.css']) {
    fs.copyFileSync(path.join(srcDir, 'vendor', file), path.join(vendorDest, file));
  }
```

with a copy sourced from `node_modules`:

```js
  const vendorDest = path.join(outdir, 'vendor');
  fs.mkdirSync(vendorDest, { recursive: true });
  // Physical assets referenced verbatim by HTML (classic <script> / <link>), copied
  // straight from node_modules — no src/vendor snapshot, no postinstall step.
  const nodeModules = path.join(root, 'node_modules');
  const assets = [
    { src: path.join(nodeModules, 'webextension-polyfill', 'dist', 'browser-polyfill.js'), dest: 'browser-polyfill.js' },
    { src: path.join(nodeModules, 'bulma', 'css', 'bulma.css'), dest: 'bulma.css' },
  ];
  for (const { src, dest } of assets) {
    fs.copyFileSync(src, path.join(vendorDest, dest));
  }
```

- [ ] **Step 2: Update the copyAssets header comment**

In `scripts/build.js`, the comment block above `function copyAssets(t)` (around lines 42-46) currently says the assets come from `src/vendor`. Replace that comment block:

```js
// Copy assets that are referenced verbatim by HTML/manifest (NOT bundled):
//  - all of src/static (HTML, style.css, images)
//  - browser-polyfill.js (loaded as a classic <script> in every page)
//  - bulma.css (loaded via <link>)
// turndown/gfm/mustache .mjs are NOT copied — esbuild bundles them into entries.
```

with:

```js
// Copy assets that are referenced verbatim by HTML/manifest (NOT bundled):
//  - all of src/static (HTML, style.css, images)
//  - browser-polyfill.js (loaded as a classic <script> in every page)
//  - bulma.css (loaded via <link>)
// The two physical assets are copied straight from node_modules (no src/vendor
// snapshot). turndown/gfm/mustache are bundled by esbuild from node_modules too.
```

- [ ] **Step 3: Drop the `src/vendor` watcher**

In `scripts/build.js`, in the watch branch, remove the line that watches `src/vendor` for asset changes (around line 114):

```js
  watchAssets(path.join(srcDir, 'vendor'));
```

Leave `watchAssets(path.join(srcDir, 'static'));` in place. (`node_modules` assets do not change during development, so there is nothing to re-copy on the fly.)

- [ ] **Step 4: Build both targets and verify the copied assets exist and match node_modules**

Run:
```bash
npm run build
cmp node_modules/webextension-polyfill/dist/browser-polyfill.js chrome/dist/vendor/browser-polyfill.js && echo "polyfill-ok"
cmp node_modules/bulma/css/bulma.css chrome/dist/vendor/bulma.css && echo "bulma-ok"
cmp node_modules/webextension-polyfill/dist/browser-polyfill.js firefox-mv3/dist/vendor/browser-polyfill.js && echo "ff-polyfill-ok"
```
Expected: both target builds succeed, the assert-no-turndown line prints, and `polyfill-ok` / `bulma-ok` / `ff-polyfill-ok` print (copied files are byte-identical to the node_modules sources).

- [ ] **Step 5: Commit**

```bash
git add scripts/build.js
git commit -m "build: copy browser-polyfill + bulma from node_modules

Removes the src/vendor dependency from the asset-copy step and the
src/vendor watch in --watch mode.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Delete shims, vendor dir, postinstall script, and the npm hook

Now that nothing imports them and the build no longer reads `src/vendor`, delete the indirection.

**Files:**
- Delete: `src/shims/` (whole dir)
- Delete: `src/vendor/` (whole dir)
- Delete: `scripts/postinstall.js`
- Modify: `package.json` (remove the `postinstall` script line)

- [ ] **Step 1: Confirm nothing still references vendor/shims**

Run: `grep -rn "vendor/\|shims/" src scripts ; echo "exit:$?"`
Expected: only `src/static/*.html` lines referencing `../vendor/browser-polyfill.js` and `../vendor/bulma.css` (those are dist-relative paths, unchanged — still valid because the build writes `dist/vendor/`). No `src/lib/*`, no `src/shims/*`, no `scripts/*` matches. If any `src/lib` or `scripts` match remains, fix it before deleting.

- [ ] **Step 2: Delete the directories and the postinstall script**

```bash
git rm -r src/shims src/vendor scripts/postinstall.js
```

- [ ] **Step 3: Remove the `postinstall` npm script**

In `package.json`, delete this line from `scripts`:

```json
    "postinstall": "node scripts/postinstall.js",
```

- [ ] **Step 4: Typecheck, lint, and build to confirm nothing broke**

Run:
```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all three succeed; the assert-no-turndown line prints during `build-chrome`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete src/vendor, src/shims, and postinstall script

esbuild now resolves these from node_modules directly; the vendored
copies, the re-export shims, and the postinstall copy step are gone.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Update docs (build.md + README)

**Files:**
- Modify: `docs/build.md` (item 3 of "How it works", around line 30-32; license section line 79)
- Modify: `README.md` (vendor/third-party wording, if present)

- [ ] **Step 1: Update the asset-copy description in `docs/build.md`**

In `docs/build.md`, replace item 3 under "How it works" (around lines 30-32):

```markdown
3. Copies assets that HTML/manifest reference verbatim: `src/static/**`,
   `src/vendor/browser-polyfill.js`, `src/vendor/bulma.css`. The vendored `turndown`, `gfm`, and
   `mustache` `.mjs` files are **bundled** (not copied) into the entries that import them.
```

with:

```markdown
3. Copies assets that HTML/manifest reference verbatim into `<target>/dist/vendor/`: `src/static/**`,
   plus `browser-polyfill.js` and `bulma.css` copied straight from `node_modules`
   (`webextension-polyfill/dist/` and `bulma/css/`). `turndown`, `@truto/turndown-plugin-gfm`, and
   `mustache` are **bundled** (not copied) by esbuild from `node_modules` into the entries that
   import them — there is no `src/vendor` snapshot and no `postinstall` copy step.
```

- [ ] **Step 2: Verify the README and rest of build.md for stale vendor wording**

Run: `grep -rn -i "postinstall\|src/vendor\|vendored" README.md docs/build.md`
Expected: review each remaining hit. The license section of `docs/build.md` (around line 79) says `browser-polyfill.js` and `bulma.css` "ship as standalone copied files with their headers intact" — that is still true (just copied from node_modules), so leave it. Edit any line that claims the files come from `src/vendor` or are produced by `postinstall`. If `README.md` has no vendor/postinstall mention, no change there.

- [ ] **Step 3: Commit**

```bash
git add docs/build.md README.md
git commit -m "docs: describe node_modules asset copy (no src/vendor/postinstall)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification + clean-install check

**Files:** none modified — this is the acceptance gate.

- [ ] **Step 1: Run the full local gate**

Run:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: typecheck PASS, lint PASS, vitest all green (including `test/build/no-turndown-in-chrome-background.test.ts`), both target builds succeed, assert-no-turndown line prints.

- [ ] **Step 2: Confirm no domino in any bundle (both targets)**

Run:
```bash
grep -rl domino chrome/dist/ firefox-mv3/dist/ ; echo "domino-grep-exit:$?"
```
Expected: `domino-grep-exit:1` with no files listed (no domino anywhere).

- [ ] **Step 3: Run the Chrome e2e suite (verifies offscreen conversion end-to-end)**

Run: `npm run test:e2e`
Expected: Playwright builds the test extension and runs green. This exercises real Markdown conversion through the Chrome offscreen document.

- [ ] **Step 4: Clean-install check (proves no postinstall, no regenerated vendor)**

Run:
```bash
npm ci
test ! -e src/vendor && echo "no-vendor-ok"
test ! -e scripts/postinstall.js && echo "no-postinstall-ok"
git status --porcelain
```
Expected: `npm ci` completes with no `postinstall` step in its output; `no-vendor-ok` and `no-postinstall-ok` print; `git status --porcelain` is empty (clean tree — nothing was regenerated).

- [ ] **Step 5: Write the PR note**

Append a short PR note to the spec file (or hand it to the user for the PR description). Content:

```markdown
## PR note: new dependency wiring

- turndown, @truto/turndown-plugin-gfm, mustache are now imported by package name and bundled by
  esbuild from node_modules (previously vendored into src/vendor and re-exported via src/shims).
- esbuild `platform:'browser'` selects turndown's browser build (real DOM) and stubs out domino —
  verified absent from every bundle.
- browser-polyfill.js and bulma.css are copied into <target>/dist/vendor/ straight from
  node_modules at build time (settings.ts now imports 'webextension-polyfill').
- Removed scripts/postinstall.js + the postinstall npm hook, src/vendor/, and src/shims/.
- Invariant preserved: Turndown absent from chrome/dist/background.js, present in
  chrome/dist/offscreen.js (assert-no-turndown.js + the build test still pass).
```

- [ ] **Step 6: Final commit (if the PR note was added to a tracked file)**

```bash
git add -A
git commit -m "docs: add PR note on dependency wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** Task 1 = `platform:'browser'`. Task 2 = turndown+gfm imports + domino/placement proof. Task 3 = mustache. Task 4 = settings.ts → webextension-polyfill. Task 5 = asset copy from node_modules + watcher drop. Task 6 = delete vendor/shims/postinstall + npm hook. Task 7 = docs. Task 8 = full gates (typecheck/lint/test/build/e2e/`npm ci`) + no-domino + PR note. All spec sections mapped.
- **Ordering rationale:** config (`platform`) and import rewires land before deleting `src/vendor`/`src/shims`, so every intermediate commit builds and typechecks. Asset re-sourcing (Task 5) precedes the directory delete (Task 6) so the build never reads a deleted path.
- **gfm types:** primary path is package types (no ambient `.d.ts`); ambient fallback is gated behind an actual typecheck failure in Task 2 Step 2.
