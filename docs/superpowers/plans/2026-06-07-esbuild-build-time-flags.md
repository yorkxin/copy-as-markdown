# esbuild Compile-Time Build Flags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `tsc → copy` build with a per-target esbuild build that bakes in a `BUILD_TARGET` define, so dead-code elimination physically excludes Turndown from the Chrome MV3 service-worker bundle.

**Architecture:** A single `scripts/build.js <chrome|firefox-mv3>` cleans the target's `dist/`, bundles each entry point with esbuild (`bundle:true`, `splitting:false`, `define:{BUILD_TARGET}`), and copies static/vendor assets. Target divergence in `background.ts` moves from runtime globals (`firefox-mv3/hacks.js` + `src/config/flags.ts`) to compile-time `BUILD_TARGET === 'firefox-mv3'` branches. A post-build assertion + a vitest test prove Turndown is absent from the Chrome background bundle.

**Tech Stack:** Node 20 ESM, esbuild, TypeScript (typecheck only), Vitest, Playwright, web-ext.

**Reference spec:** `docs/superpowers/specs/2026-06-07-esbuild-build-time-flags-design.md`

---

## File Structure

**Create:**
- `scripts/build.js` — per-target esbuild build (clean + bundle + asset copy + `--watch`).
- `scripts/assert-no-turndown.js` — fails the build if Turndown leaks into `chrome/dist/background.js`.
- `src/types/build-target.d.ts` — ambient `declare const BUILD_TARGET`.
- `test/build/no-turndown-in-chrome-background.test.ts` — vitest guard for the same invariant.
- `docs/build.md` — short PR note: the new build + how to add an entry point.

**Modify:**
- `package.json` — add `esbuild`, remove `nodemon`/`@types/nodemon`; rework scripts.
- `src/services/markdown-converter.ts` — lazy `import()` → static import.
- `src/lib/html-to-markdown.ts` — update the ⚠️ header comment.
- `src/background.ts` — `Flags.*` → `BUILD_TARGET` branches; drop `Flags` import.
- `scripts/debug.js` — nodemon → esbuild `--watch` child process.
- `firefox-mv3/manifest.json` — drop `hacks.js` from `background.scripts`.
- `tsconfig.json` — remove vestigial `outDir`.
- `src/static/about.html` — verify/add third-party license coverage.

**Delete:**
- `src/config/flags.ts`
- `firefox-mv3/hacks.js`
- `scripts/compile.js`

---

## Task 1: Add esbuild + ambient BUILD_TARGET declaration

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `src/types/build-target.d.ts`

- [ ] **Step 1: Install esbuild**

Run:
```bash
npm install --save-dev esbuild
```
Expected: `esbuild` appears in `devDependencies`. (`nodemon`/`@types/nodemon` are removed in Task 7, when `debug.js` stops using them.)

- [ ] **Step 2: Create the ambient declaration**

Create `src/types/build-target.d.ts`:
```ts
/**
 * Injected by esbuild's `define` at build time (see scripts/build.js).
 * `'chrome'` for the Chrome MV3 build, `'firefox-mv3'` for the Firefox build.
 * Branches gated on this constant are dead-code-eliminated for the other target.
 */
declare const BUILD_TARGET: 'chrome' | 'firefox-mv3';
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: PASS (no emit; `src/**` is already in `tsconfig` `include`, so the new `.d.ts` is picked up).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/types/build-target.d.ts
git commit -m "build: add esbuild dep and ambient BUILD_TARGET declaration"
```

---

## Task 2: Create scripts/build.js and wire compile-* scripts (parity checkpoint)

This produces working Chrome + Firefox builds via esbuild **before** any source changes. Behavior stays identical to today: `firefox-mv3/hacks.js` + `flags.ts` still drive runtime divergence; Turndown is still present (loaded lazily on Firefox, unused on Chrome). This is the spec's "port background.ts first, confirm parity" gate.

**Files:**
- Create: `scripts/build.js`
- Modify: `package.json` (scripts: `compile`, `compile-chrome`, `compile-firefox-mv3`)

- [ ] **Step 1: Write scripts/build.js**

Create `scripts/build.js`:
```js
#!/usr/bin/env node
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const root = path.join(import.meta.dirname, '..');
const target = process.argv[2]; // 'chrome' | 'firefox-mv3'
const watch = process.argv.includes('--watch');

if (target !== 'chrome' && target !== 'firefox-mv3') {
  throw new Error(`unsupported target: ${target} (expected 'chrome' or 'firefox-mv3')`);
}

const srcDir = path.join(root, 'src');
const outdir = path.join(root, target, 'dist');

// Entry points loaded by the manifest (background, offscreen) and by src/static/*.html.
// NOTE: src/ui/permissions-ui.ts is NOT an entry — it's a helper imported by
// options.ts and options-permissions.ts, so esbuild bundles it into those entries.
// NOTE: the `options-ui.js` <script> refs in about/single-link/custom-format-help.html
// are a pre-existing DEAD reference (no source file; the old tsc build never produced
// it either). Not built here; fixing those HTML refs is out of scope.
const sharedEntries = [
  'src/background.ts',
  'src/ui/popup.ts',
  'src/ui/options.ts',
  'src/ui/options-permissions.ts',
  'src/ui/permissions.ts',
  'src/ui/custom-format.ts',
  'src/ui/check-custom-formats.ts',
  'src/ui/built-in-style-options.ts',
];

function entryPointsFor(t) {
  const entries = [...sharedEntries];
  // Firefox has no offscreen API; only Chrome ships the offscreen document.
  if (t === 'chrome') entries.push('src/offscreen.ts');
  return entries.map(e => path.join(root, e));
}

// Copy assets that are referenced verbatim by HTML/manifest (NOT bundled):
//  - all of src/static (HTML, style.css, images)
//  - browser-polyfill.js (loaded as a classic <script> in every page)
//  - bulma.css (loaded via <link>)
// turndown/gfm/mustache .mjs are NOT copied — esbuild bundles them into entries.
function copyAssets(t) {
  fs.cpSync(path.join(srcDir, 'static'), path.join(outdir, 'static'), {
    recursive: true,
    filter: (src) => {
      // Firefox ships no offscreen document.
      if (t === 'firefox-mv3' && path.basename(src) === 'offscreen.html') return false;
      return true;
    },
  });
  const vendorDest = path.join(outdir, 'vendor');
  fs.mkdirSync(vendorDest, { recursive: true });
  for (const file of ['browser-polyfill.js', 'bulma.css']) {
    fs.copyFileSync(path.join(srcDir, 'vendor', file), path.join(vendorDest, file));
  }
}

const buildOptions = {
  entryPoints: entryPointsFor(target),
  bundle: true,
  format: 'esm',
  splitting: false,            // MV3 service worker: one file per entry, no chunks
  treeShaking: true,
  outdir,
  outbase: srcDir,             // preserve entry directory layout under dist/
  sourcemap: 'linked',         // emit .js.map + sourceMappingURL (DevTools breakpoints)
  sourcesContent: true,        // embed original TS in the map
  minify: false,               // never minify (readable source, simple maps)
  legalComments: 'eof',        // preserve bundled libs' /*! and @license banners
  define: { BUILD_TARGET: JSON.stringify(target) },
  target: target === 'chrome' ? ['chrome116'] : ['firefox139'],
  logLevel: 'info',
};

// esbuild does NOT clean the outdir; remove stale files first for deterministic output.
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

// chrome/dist/* and firefox-mv3/dist/* are gitignored EXCEPT a tracked empty `.keep`
// placeholder. The rmSync above deletes it; recreate it so the build leaves a clean
// git status.
function restoreKeep() {
  fs.writeFileSync(path.join(outdir, '.keep'), '');
}

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  copyAssets(target);
  restoreKeep();
  fs.watch(path.join(srcDir, 'static'), { recursive: true }, () => copyAssets(target));
  fs.watch(path.join(srcDir, 'vendor'), { recursive: true }, () => copyAssets(target));
  console.log(`[build] watching ${target} ...`);
} else {
  await esbuild.build(buildOptions);
  copyAssets(target);
  restoreKeep();
  console.log(`[build] built ${target}`);
}
```

- [ ] **Step 2: Point compile-* scripts at build.js**

In `package.json` `scripts`, replace these three lines:
```json
    "compile": "npm run build:ts && npm run compile-chrome && npm run compile-firefox-mv3",
    "compile-chrome": "node scripts/compile.js chrome",
    "compile-firefox-mv3": "node scripts/compile.js firefox-mv3",
```
with:
```json
    "compile": "npm run compile-chrome && npm run compile-firefox-mv3",
    "compile-chrome": "node scripts/build.js chrome",
    "compile-firefox-mv3": "node scripts/build.js firefox-mv3",
```
(The `assert-no-turndown` wiring is added in Task 5. `build:ts` is removed in Task 8.)

- [ ] **Step 3: Build both targets**

Run:
```bash
npm run clean
npm run compile
```
Expected: both commands succeed. Verify expected files exist:
```bash
ls chrome/dist/background.js chrome/dist/offscreen.js chrome/dist/ui/popup.js \
   chrome/dist/static/popup.html chrome/dist/vendor/browser-polyfill.js chrome/dist/vendor/bulma.css
ls firefox-mv3/dist/background.js firefox-mv3/dist/ui/popup.js \
   firefox-mv3/dist/static/popup.html firefox-mv3/dist/vendor/browser-polyfill.js
test ! -e firefox-mv3/dist/offscreen.js && echo "OK: firefox has no offscreen.js"
test ! -e firefox-mv3/dist/static/offscreen.html && echo "OK: firefox has no offscreen.html"
```
Expected: all `chrome/dist/...` and `firefox-mv3/dist/...` listed files exist; both "OK:" lines print. (Source maps `*.js.map` exist next to each entry.) `chrome/dist/ui/` should contain exactly: `popup.js`, `options.js`, `options-permissions.js`, `permissions.js`, `custom-format.js`, `check-custom-formats.js`, `built-in-style-options.js` (7 entries, each with a `.js.map`). There is NO `options-ui.js` (dead HTML ref, no source) and NO standalone `permissions-ui.js` (helper, bundled into options/options-permissions).

- [ ] **Step 4: Confirm load parity in a real browser (manual)**

Load the freshly built output directly with `web-ext` (avoids `debug.js`, which is still
nodemon-based and is rewritten in Task 7):

Run: `npx web-ext run -s chrome -t chromium --args https://example.com`
Expected: the extension loads with no service-worker errors; the popup opens, "Copy current tab" copies a Markdown link, and "Copy Selection as Markdown" on a page with selected rich text produces Markdown. Close the browser to stop.

Then run: `npx web-ext run -s firefox-mv3 --url https://example.com` and repeat the smoke check.
Expected: identical behavior (Firefox still uses `hacks.js` globals; Event-Page Turndown conversion works).

- [ ] **Step 5: Commit**

```bash
git add scripts/build.js package.json
git commit -m "build: add esbuild per-target build (parity with tsc+copy)"
```

---

## Task 3: Hoist the markdown-converter lazy import to a static import

After this, the Chrome bundle statically inlines Turndown (transient, intentional). We never *load* this Chrome build until Task 5 makes it correct again — the only consumers in between are string-based assertions, not the running service worker.

**Files:**
- Modify: `src/services/markdown-converter.ts`
- Modify: `src/lib/html-to-markdown.ts:1-8` (header comment)

- [ ] **Step 1: Replace createEventPageMarkdownConverter with a static-import version**

In `src/services/markdown-converter.ts`, add the static import just below the existing `import type { Options as TurndownOptions } from 'turndown';` line at the top:
```ts
import { htmlToMarkdown } from '../lib/html-to-markdown.js';
```

Then replace the entire `createEventPageMarkdownConverter` function (the JSDoc block with the ⚠️ warnings and the `htmlToMarkdownPromise` lazy `import()`) with:
```ts
/**
 * Firefox: convert directly in the Event Page (which has a DOM).
 *
 * `html-to-markdown` (which statically imports Turndown) is a NORMAL static
 * import above. On the Chrome build, `BUILD_TARGET` dead-code elimination drops
 * the call to this function in background.ts, so esbuild tree-shakes this
 * function — and html-to-markdown/Turndown — out of the Chrome service-worker
 * bundle. That exclusion is enforced by scripts/assert-no-turndown.js and
 * test/build/no-turndown-in-chrome-background.test.ts.
 */
export function createEventPageMarkdownConverter(): MarkdownConverter {
  async function convert(html: string, options: TurndownOptions): Promise<string> {
    return htmlToMarkdown(html, options);
  }

  return { convert };
}
```

- [ ] **Step 2: Update the html-to-markdown header comment**

In `src/lib/html-to-markdown.ts`, replace the top ⚠️ comment block (lines 1-8, ending before `import type { Rule, ...`) with:
```ts
// ⚠️ SERVICE-WORKER SAFETY: this module statically imports Turndown, which touches
// the DOM at module load, so it must only run in a DOM-bearing context (the Chrome
// offscreen document or the Firefox Event Page) — never the Chrome MV3 service worker.
// Exclusion from the Chrome service-worker bundle is now enforced at COMPILE TIME:
// background.ts selects the converter via `BUILD_TARGET`, so on Chrome the Firefox
// branch (the only path that imports this module) is dead-code-eliminated and
// tree-shaken away. The invariant is verified by scripts/assert-no-turndown.js and
// test/build/no-turndown-in-chrome-background.test.ts.
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Confirm Turndown is now inlined in the Chrome bundle (sets up the RED test)**

Run:
```bash
node scripts/build.js chrome
grep -c "TurndownService" chrome/dist/background.js
```
Expected: a non-zero count — Turndown is currently inside `chrome/dist/background.js` because the runtime flag (not yet `BUILD_TARGET`) prevents DCE. This is the expected transient state.

- [ ] **Step 5: Commit**

```bash
git add src/services/markdown-converter.ts src/lib/html-to-markdown.ts
git commit -m "refactor: make Event-Page converter use a static html-to-markdown import"
```

---

## Task 4: Add the Turndown-absence assertion + vitest test (RED)

**Files:**
- Create: `scripts/assert-no-turndown.js`
- Create: `test/build/no-turndown-in-chrome-background.test.ts`

- [ ] **Step 1: Write the assertion script**

Create `scripts/assert-no-turndown.js`:
```js
#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const root = path.join(import.meta.dirname, '..');
const bundlePath = path.join(root, 'chrome', 'dist', 'background.js');

if (!fs.existsSync(bundlePath)) {
  console.error(`✗ ${bundlePath} not found — run \`node scripts/build.js chrome\` first`);
  process.exit(1);
}

const source = fs.readFileSync(bundlePath, 'utf8');
// `TurndownService` is the Turndown class identifier (real code, not a comment),
// so it survives only if Turndown is actually bundled. Reliable sentinel.
if (/TurndownService/.test(source)) {
  console.error('✗ Turndown leaked into chrome/dist/background.js (matched: TurndownService)');
  console.error('  The Chrome MV3 service worker must not bundle DOM-only Turndown code.');
  process.exit(1);
}
console.log('✓ chrome/dist/background.js is free of Turndown');
```

- [ ] **Step 2: Write the vitest test**

Create `test/build/no-turndown-in-chrome-background.test.ts`:
```ts
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const bundlePath = path.join(root, 'chrome', 'dist', 'background.js');

describe('chrome background bundle', () => {
  beforeAll(() => {
    // Build the Chrome target so the assertion runs against fresh output.
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  }, 120_000);

  it('does not bundle Turndown (DOM-only) code', () => {
    const source = readFileSync(bundlePath, 'utf8');
    expect(source).not.toMatch(/TurndownService/);
  });
});
```

- [ ] **Step 3: Run the test — expect RED**

Run: `npx vitest run --project unit test/build/no-turndown-in-chrome-background.test.ts`
Expected: FAIL — `expect(source).not.toMatch(/TurndownService/)` fails because Turndown is currently inlined (from Task 3). This confirms the test actually detects a leak.

- [ ] **Step 4: Run the assertion script — expect failure**

Run: `node scripts/build.js chrome && node scripts/assert-no-turndown.js`
Expected: exits non-zero with "✗ Turndown leaked into chrome/dist/background.js".

- [ ] **Step 5: Commit (RED checkpoint)**

```bash
git add scripts/assert-no-turndown.js test/build/no-turndown-in-chrome-background.test.ts
git commit -m "test: add failing Turndown-absence guard for chrome background bundle"
```

---

## Task 5: Convert background.ts to BUILD_TARGET (GREEN) + wire the assertion

**Files:**
- Modify: `src/background.ts`
- Modify: `package.json` (`compile-chrome`)

- [ ] **Step 1: Replace the flag reads with BUILD_TARGET branches**

In `src/background.ts`, delete the import line:
```ts
import { Flags } from './config/flags.js';
```

Delete these two lines and their `// Check if ...` comment (around lines 42-44):
```ts
// Check if ALWAYS_USE_NAVIGATOR_COPY_API flag is set
const useNavigatorClipboard = Flags.alwaysUseNavigatorClipboard();
const convertMarkdownInBackground = Flags.convertMarkdownInBackground();
```

Replace the `offscreenDocumentService` assignment:
```ts
const offscreenDocumentService = convertMarkdownInBackground
  ? null
  : createBrowserOffscreenDocumentService();
```
with:
```ts
// Chrome shares ONE offscreen document between clipboard writes and Markdown
// conversion. Firefox has no offscreen API (navigator.clipboard + Event Page).
const offscreenDocumentService = BUILD_TARGET === 'firefox-mv3'
  ? null
  : createBrowserOffscreenDocumentService();
```

Replace the `clipboardService` first argument:
```ts
const clipboardService = createBrowserClipboardServiceController(
  useNavigatorClipboard ? navigator.clipboard : null,
  offscreenDocumentService,
);
```
with:
```ts
const clipboardService = createBrowserClipboardServiceController(
  BUILD_TARGET === 'firefox-mv3' ? navigator.clipboard : null,
  offscreenDocumentService,
);
```

Replace the `markdownConverter` assignment:
```ts
const markdownConverter: MarkdownConverter = convertMarkdownInBackground
  ? createEventPageMarkdownConverter()
  : createOffscreenMarkdownConverter(offscreenDocumentService!);
```
with:
```ts
const markdownConverter: MarkdownConverter = BUILD_TARGET === 'firefox-mv3'
  ? createEventPageMarkdownConverter()
  : createOffscreenMarkdownConverter(offscreenDocumentService!);
```

(Direct `BUILD_TARGET === 'firefox-mv3'` comparisons — not an intermediate `const` — so esbuild constant-folds and DCE-drops the dead branch reliably.)

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS. (`Flags` is no longer referenced; `flags.ts` still exists — it's deleted in Task 6.)

- [ ] **Step 3: Run the absence test — expect GREEN**

Run: `npx vitest run --project unit test/build/no-turndown-in-chrome-background.test.ts`
Expected: PASS — the Chrome `firefox-mv3` branch is DCE'd, `createEventPageMarkdownConverter` is tree-shaken, Turndown is gone.

- [ ] **Step 4: Confirm Firefox still bundles Turndown**

Run:
```bash
node scripts/build.js firefox-mv3
grep -c "TurndownService" firefox-mv3/dist/background.js
```
Expected: non-zero — Firefox keeps the Event-Page converter and Turndown, as intended.

- [ ] **Step 5: Wire the assertion into compile-chrome**

In `package.json`, change:
```json
    "compile-chrome": "node scripts/build.js chrome",
```
to:
```json
    "compile-chrome": "node scripts/build.js chrome && node scripts/assert-no-turndown.js",
```

Run: `npm run compile-chrome`
Expected: builds, then prints "✓ chrome/dist/background.js is free of Turndown".

- [ ] **Step 6: Commit (GREEN checkpoint)**

```bash
git add src/background.ts package.json
git commit -m "feat: select markdown converter at compile time via BUILD_TARGET"
```

---

## Task 6: Delete the retired runtime-flag machinery

**Files:**
- Delete: `src/config/flags.ts`, `firefox-mv3/hacks.js`
- Modify: `firefox-mv3/manifest.json`

(`scripts/compile.js` is deleted in Task 7, after `debug.js` stops referencing it.)

- [ ] **Step 1: Delete the files**

Run:
```bash
git rm src/config/flags.ts firefox-mv3/hacks.js
```
Expected: two files removed. (`flags.ts` had only the two now-migrated accessors; grep already confirmed `Flags` has no other consumers.)

- [ ] **Step 2: Remove hacks.js from the Firefox manifest**

In `firefox-mv3/manifest.json`, change the `background` block:
```json
  "background": {
    "scripts": [
      "hacks.js",
      "./dist/background.js"
    ],
    "type": "module"
  },
```
to:
```json
  "background": {
    "scripts": [
      "./dist/background.js"
    ],
    "type": "module"
  },
```

- [ ] **Step 3: Rebuild and re-verify the invariant**

Run:
```bash
npm run compile
node scripts/assert-no-turndown.js
```
Expected: both succeed; assertion prints "✓ ...free of Turndown".

- [ ] **Step 4: Smoke-test Firefox without hacks.js (manual)**

Run: `npx web-ext run -s firefox-mv3 --url https://example.com`
Expected: extension loads with no errors; popup copies a Markdown link; "Copy Selection as Markdown" produces Markdown (Event-Page Turndown path). Close to stop. This confirms removing the `hacks.js` globals did not change Firefox behavior (BUILD_TARGET now covers it).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build: remove hacks.js and flags.ts (BUILD_TARGET replaces them)"
```

---

## Task 7: Switch debug/watch to esbuild

> **Harden the build.js watch path here (deferred from Task 2 code review).** Task 7 is the first
> caller of `node scripts/build.js <target> --watch`, so before/with the debug.js rewrite, make the
> watch path in `scripts/build.js` robust:
> 1. Wrap the `fs.watch` asset-recopy callbacks so a thrown `copyAssets` error (transient FS noise
>    from editor atomic-saves, etc.) is caught and logged instead of crashing the watcher — e.g.
>    `const onAssetChange = () => { try { copyAssets(target); } catch (err) { console.error('[build] asset copy failed:', err); } };`
>    and pass `onAssetChange` to both `fs.watch` calls.
> 2. `fs.watch(..., { recursive: true })` is unreliable on Linux on some Node 20.x/filesystem
>    combos. Guard it: wrap the two recursive `fs.watch` registrations in try/catch and, on
>    `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM`, log a clear warning that asset auto-recopy is disabled
>    (JS rebuilds via esbuild still work; only static/vendor live-copy is affected). Do not let this
>    crash `--watch`.
>
> Keep these changes minimal and within the existing watch branch; re-verify `node scripts/build.js
> chrome --watch` starts cleanly on this machine.

**Files:**
- Modify: `scripts/debug.js`
- Modify: `scripts/build.js` (harden watch path per the note above)
- Delete: `scripts/compile.js`
- Modify: `package.json` (remove `nodemon`/`@types/nodemon`)

- [ ] **Step 1: Rewrite debug.js to use esbuild --watch**

Replace the entire contents of `scripts/debug.js` with:
```js
#!/usr/bin/env node
import * as process from 'node:process';
import child_process from 'node:child_process';
import * as path from 'node:path';

const browser = process.argv[2];
const root = path.join(import.meta.dirname, '..');

/** Start `scripts/build.js <target> --watch` as a child process. */
function startWatch(target) {
  return child_process.spawn(
    'node',
    [path.join(root, 'scripts/build.js'), target, '--watch'],
    { stdio: 'inherit' },
  );
}

/** @type {child_process.ChildProcess} */
let builder;
/** @type {child_process.ChildProcess} */
let spawnedBrowser;

const edgeBinary = {
  darwin: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  win32: '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"',
};

switch (browser) {
  case 'chrome':
    console.log('starting chrome');
    builder = startWatch('chrome');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --args chrome://extensions https://example.com`);
    break;
  case 'edge': {
    console.log('starting edge');
    const binary = edgeBinary[process.platform];
    if (typeof binary === 'undefined') {
      throw new TypeError(`unsupported Edge platform: ${process.platform}`);
    }
    builder = startWatch('chrome');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --chromium-binary "${binary}" --args chrome://extensions https://example.com`);
    break;
  }
  case 'firefox-mv3':
    console.log('starting firefox-mv3');
    builder = startWatch('firefox-mv3');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'firefox-mv3')} --url about:debugging#/runtime/this-firefox https://example.com`);
    break;
  default:
    throw new Error(`unsupported browser ${browser}`);
}

spawnedBrowser.on('exit', () => {
  console.log('browser exited');
  if (builder) builder.kill();
  process.exit(0);
});
```

(Note: `debug-firefox-deved` still routes to the `default` case and throws today — pre-existing behavior, left unchanged and out of scope.)

- [ ] **Step 2: Delete the superseded compile.js and remove nodemon**

`scripts/debug.js` no longer references `scripts/compile.js`, so both it and `nodemon` can go now.

Run:
```bash
git rm scripts/compile.js
npm uninstall nodemon @types/nodemon
```
Expected: `scripts/compile.js` removed; `nodemon` and `@types/nodemon` gone from `devDependencies`.

- [ ] **Step 3: Smoke-test watch rebuild (manual)**

Run: `npm run debug-chrome`
Expected: build runs, Chrome opens with the extension. Edit a string in `src/ui/popup.ts` (e.g. a button label), save, reopen the popup — the change appears (esbuild rebuilds on save; web-ext reloads). Close the browser; the watch process exits.

- [ ] **Step 4: Verify source-map debugging (manual)**

With `npm run debug-chrome` running, open the service worker DevTools (chrome://extensions → "service worker") → Sources. Confirm the **Authored** tree shows `src/background.ts`, `src/services/markdown-converter.ts`, etc., and a breakpoint set in `src/lib/settings.ts` binds and hits. Close to stop.

- [ ] **Step 5: Commit**

```bash
git add scripts/debug.js package.json package-lock.json
git commit -m "build: drive debug watch with esbuild; drop nodemon and compile.js"
```

---

## Task 8: Finalize package.json scripts + tsconfig

**Files:**
- Modify: `package.json` (scripts, remove `build:ts`/`test:all`, consolidate e2e, trim `clean`)
- Modify: `tsconfig.json` (remove `outDir`)

- [ ] **Step 1: Remove build:ts and test:all; consolidate the e2e scripts**

In `package.json` `scripts`:

Delete this line:
```json
    "build:ts": "tsc",
```
Delete this line:
```json
    "test:all": "npm test && npm run test:e2e",
```
Replace the four e2e lines:
```json
    "test:e2e": "npm run compile && node scripts/build-test-extension.js && playwright test",
    "test:e2e:headed": "npm run compile && node scripts/build-test-extension.js && playwright test --headed",
    "test:e2e:ui": "npm run compile && node scripts/build-test-extension.js && playwright test --ui",
    "test:e2e:debug": "npm run compile && node scripts/build-test-extension.js && playwright test --debug",
```
with:
```json
    "test:e2e:build": "npm run compile && node scripts/build-test-extension.js",
    "test:e2e": "npm run test:e2e:build && playwright test",
    "test:e2e:headed": "npm run test:e2e:build && playwright test --headed",
    "test:e2e:ui": "npm run test:e2e:build && playwright test --ui",
    "test:e2e:debug": "npm run test:e2e:build && playwright test --debug",
```

- [ ] **Step 2: Trim the dead ./dist/* from clean**

Replace:
```json
    "clean": "rm -rf ./build/* ./dist/* ./{firefox-mv3,chrome}/dist/* ./{firefox-test,chrome-test,chrome-optional-test}/*",
```
with:
```json
    "clean": "rm -rf ./build/* ./{firefox-mv3,chrome}/dist/* ./{firefox-test,chrome-test,chrome-optional-test}/*",
```

- [ ] **Step 3: Remove the vestigial tsconfig outDir**

In `tsconfig.json`, delete the line under `compilerOptions`:
```json
    "outDir": "./dist",
```
(esbuild owns emit; `tsc --noEmit` never writes. The `"dist"` entry in `exclude` can stay — harmless.)

- [ ] **Step 4: Verify the full local suite**

Run:
```bash
npm run typecheck
npm run lint
npm run clean
npm test
```
Expected: typecheck PASS; lint PASS; `npm test` PASS (unit + browser projects, including the Turndown-absence test which builds Chrome in `beforeAll`).

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json
git commit -m "build: prune build:ts/test:all, consolidate e2e scripts, drop dead dist paths"
```

---

## Task 9: Verify third-party license coverage in about.html

**Files:**
- Modify: `src/static/about.html` (only if a library is missing)

- [ ] **Step 1: Check that all five bundled libs are listed**

Run:
```bash
for lib in turndown "turndown-plugin-gfm" mustache bulma "browser-polyfill"; do
  printf '%s: ' "$lib"; grep -ci "$lib" src/static/about.html;
done
```
Expected: each library has a non-zero count. (`turndown-plugin-gfm` may be covered under the Turndown entry — confirm by reading the relevant `about.html` section.)

- [ ] **Step 2: Add any missing license entry**

If a library has a zero count (or the gfm plugin lacks attribution), read `src/static/about.html` around the existing third-party section (the `<h3>` blocks near line 145+) and add a matching `<h3>Name</h3>` + homepage link + `<details><summary>License</summary><pre>…</pre></details>` block, mirroring the existing entries. Use the license text from the dependency's `node_modules/<pkg>/LICENSE`. If all five are already present, make no change and note it in the commit-free step below.

- [ ] **Step 3: Verify legalComments preserved a banner in the bundle**

Run:
```bash
node scripts/build.js firefox-mv3
grep -rl "mustache.js - Logic-less" firefox-mv3/dist
```
Expected: at least one matching file — the `/*!` mustache banner is preserved at end-of-file by `legalComments: 'eof'` in whichever entry bundles mustache (reached via `src/lib/custom-format.ts` → `src/shims/mustache.js`). If no file matches, confirm mustache is actually reached by an entry and that the banner text wasn't reformatted; the goal is that the banner survives somewhere in the build output.

- [ ] **Step 4: Commit (only if about.html changed)**

```bash
git add src/static/about.html
git commit -m "docs: ensure about.html covers all bundled third-party licenses"
```
If `about.html` was already complete, skip this commit.

---

## Task 10: Write the build PR note

**Files:**
- Create: `docs/build.md`

- [ ] **Step 1: Write docs/build.md**

Create `docs/build.md`:
```markdown
# Build

The extension is built with **esbuild**, once per target.

## Commands

- `npm run compile` — build both `chrome/` and `firefox-mv3/`.
- `npm run compile-chrome` — build Chrome, then assert Turndown is absent from the
  service-worker bundle (`scripts/assert-no-turndown.js`).
- `npm run compile-firefox-mv3` — build Firefox.
- `npm run debug-chrome` / `debug-firefox-mv3` — esbuild `--watch` + `web-ext run`.
- `npm run typecheck` — `tsc --noEmit` (type-checking only; esbuild owns emit).

## How it works

`scripts/build.js <chrome|firefox-mv3>`:
1. Removes the target's `dist/` (esbuild does not clean stale files).
2. Bundles each entry point (`bundle:true`, `format:'esm'`, `splitting:false`) into one
   self-contained file per entry under `<target>/dist`, preserving the entry directory
   layout (`outbase:'src'`). Non-entry modules are inlined, not emitted separately.
3. Copies assets that HTML/manifest reference verbatim: `src/static/**`,
   `src/vendor/browser-polyfill.js`, `src/vendor/bulma.css`. (turndown/gfm/mustache are
   bundled, not copied.)

## Compile-time target flag

esbuild injects `define: { BUILD_TARGET }` (`'chrome'` | `'firefox-mv3'`), declared
ambiently in `src/types/build-target.d.ts`. Code branches on `BUILD_TARGET === 'firefox-mv3'`;
the dead branch is dead-code-eliminated for the other target. This is how the DOM-only
Turndown module is physically excluded from the Chrome MV3 service worker — enforced by
`scripts/assert-no-turndown.js` and `test/build/no-turndown-in-chrome-background.test.ts`.

## Source maps

Builds emit linked source maps with embedded sources (`sourcemap:'linked'`,
`sourcesContent:true`), so DevTools shows the original `src/*.ts` files for breakpoints in
both service-worker and page contexts. Output is never minified.

## Adding a new entry point

1. Add the script path to `sharedEntries` (or the Chrome-only branch) in
   `scripts/build.js` `entryPointsFor()`.
2. Create the HTML page under `src/static/` that loads it via
   `<script type="module" src="../<path>.js">` (and `../vendor/browser-polyfill.js` if it
   needs the `browser` global). `src/static/**` is copied automatically.
3. If the page is Chrome- or Firefox-only, gate it in `entryPointsFor()` /
   the `copyAssets()` filter the way `offscreen` is.
```

- [ ] **Step 2: Commit**

```bash
git add docs/build.md
git commit -m "docs: add build guide for esbuild + BUILD_TARGET"
```

---

## Task 11: Full validation (Chrome e2e)

**Files:** none (verification only)

- [ ] **Step 1: Run the complete check suite**

Run:
```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```
Expected: all PASS. The Chrome e2e builds via the new `compile` and runs Playwright against real Chrome.

- [ ] **Step 2: Re-run the known-flaky test in isolation if it tripped**

If the parallel-clipboard e2e test fails, run it alone to confirm it's the known flake, e.g.:
```bash
npx playwright test -g "clipboard" --workers=1
```
Expected: PASS in isolation. (Document the flake in the PR if it recurs.)

- [ ] **Step 3: Final invariant + artifact check**

Run:
```bash
npm run clean && npm run compile
node scripts/assert-no-turndown.js
grep -c "TurndownService" firefox-mv3/dist/background.js
```
Expected: assertion prints "✓ ...free of Turndown"; the Firefox grep prints a non-zero count (Turndown present where it belongs).

- [ ] **Step 4: Confirm the branch is clean and ready**

Run: `git status`
Expected: clean working tree; all work committed. The branch is ready for `superpowers:finishing-a-development-branch`.

---

## Self-Review notes

- **Spec coverage:** build pipeline (T2), per-target entries + offscreen trim (T2), `BUILD_TARGET` + ambient decl (T1/T5), DCE Turndown removal (T3→T5), absence check build-step + vitest (T4/T5), source maps (T2/T7), no-minify (T2), license handling §6.1 (T2 `legalComments` + T9), script changes §7 (T2/T5/T8), hacks.js/flags removal (T6), PR note §8 (T10), full re-validation (T11). All spec sections map to a task.
- **TDD arc:** the Turndown-absence test is genuinely RED at T4 (Turndown inlined after the T3 hoist) and GREEN at T5 (BUILD_TARGET DCE), so the test is proven to detect a real leak.
- **Fallback (spec §3):** if T5 Step 3 does NOT go green (esbuild keeps Turndown due to perceived side effects), apply the alias-stub fallback — add `alias: { '../lib/html-to-markdown': '../lib/html-to-markdown.stub.ts' }` for the Chrome build in `scripts/build.js` plus a no-op stub exporting `htmlToMarkdown` — then re-run T5 Step 3. Only needed if pure DCE/tree-shaking leaks.
```
