# Ship browser-polyfill to Chrome only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `webextension-polyfill` (`browser-polyfill.js`) ship to the Chrome build only and be fully absent from the Firefox build, by loading the polyfill as one shared external file imported by every entry (approach 3c).

**Architecture:** Replace the bundled `import browserPolyfill from 'webextension-polyfill'` + the classic `<script>` tags with a single side-effect import `import '/vendor/browser-polyfill.js'` in `ensure-browser-global.ts`, imported first by the service worker and every UI entry. An esbuild `onResolve` plugin keeps that import external (verbatim) for Chrome and redirects it to an empty module for Firefox. The shipped file, loaded verbatim as an ES module, self-installs `globalThis.browser`.

**Tech Stack:** Node + esbuild build (`scripts/build.js`), vitest (unit project = node env; browser project = real Chromium via playwright).

---

## Context the worker needs

- **Branch:** already on `firefox-drop-browser-polyfill` (off `master`). Do not switch branches.
- **Spec:** `docs/superpowers/specs/2026-06-14-firefox-drop-browser-polyfill-design.md`. Read the "Key enabling fact" and "Verification" sections.
- **Build commands:** `node scripts/build.js chrome` / `node scripts/build.js firefox-mv3` build into `chrome/dist/` and `firefox-mv3/dist/`. `npm run build` does both.
- **Why an absolute specifier `/vendor/browser-polyfill.js`:** esbuild does NOT rewrite *external* import paths, and entries sit at two depths (`dist/background.js`, `dist/ui/*.js`). A leading-slash specifier resolves to the extension root from any depth, and is the same string from every importer (so the esbuild plugin's `onResolve` filter matches uniformly).
- **Marker:** `wrapAPIs` is a function internal to `webextension-polyfill`. Under 3c the polyfill is never bundled, so `wrapAPIs` must appear ONLY in `chrome/dist/vendor/browser-polyfill.js`, never in any bundle, and never anywhere in `firefox-mv3/dist`.
- **The 7 UI entries:** `src/ui/popup.ts`, `options.ts`, `options-permissions.ts`, `permissions.ts`, `custom-format.ts`, `check-custom-formats.ts`, `built-in-style-options.ts`. (`offscreen.ts` uses only `chrome.*` — leave it.)
- **The 8 HTML pages with the `<script>` tag:** `popup.html`, `options.html`, `options-permissions.html`, `permissions.html`, `custom-format.html`, `multiple-links.html`, `single-link.html`, `custom-format-help.html`. `about.html` has only the attribution `<h3>` (no tag) — leave it.
- **`copyAssets(t)`** in `scripts/build.js` runs for both the one-shot build and the watch-mode re-copy, so editing it covers watch mode.
- **Modern-Chrome no-op:** the polyfill returns native `browser` on modern Chrome, so you cannot confirm it by checking `browser` exists. Verify resolution (loud-if-broken) + the isolated install-path test instead.

---

## Task 1: Pin the foundational ESM-install behavior (vitest browser test)

This characterization test proves the verbatim file, loaded as a real ES module in a Chromium page with no native `browser`, self-installs `window.browser`. It passes immediately (it pins library behavior we depend on) and runs in the vitest **browser** project.

**Files:**
- Create: `test/ui/polyfill-installs-browser.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
// `?raw` gives the verbatim file content (no Vite/CJS transform) — the exact file we ship.
import polyfillSource from '../../node_modules/webextension-polyfill/dist/browser-polyfill.js?raw';

afterEach(() => {
  document.getElementById('polyfill-under-test')?.remove();
  delete (window as any).browser;
  delete (window as any).chrome;
});

it('verbatim ESM import self-installs window.browser (old-Chrome path)', async () => {
  // Plain Chromium page has no native `browser` (that's Firefox), so a pass proves the
  // polyfill itself installed it — no false positive. Stub the minimal `chrome` the
  // polyfill guards on so it takes the wrapAPIs install branch instead of throwing.
  (window as any).chrome = { runtime: { id: 'test-extension-id' } };
  expect((window as any).browser).toBeUndefined();

  // A dynamically inserted <script type="module"> with inline content executes as ESM.
  const script = document.createElement('script');
  script.type = 'module';
  script.id = 'polyfill-under-test';
  script.textContent = polyfillSource;
  document.head.appendChild(script);

  await vi.waitFor(() => {
    expect((window as any).browser).toBeDefined();
  }, { timeout: 800, interval: 20 });

  expect(typeof (window as any).browser).toBe('object');
  expect((window as any).browser).toHaveProperty('runtime');
});
```

- [ ] **Step 2: Run it — expect PASS (pins existing library behavior)**

Run: `npx vitest run --project browser test/ui/polyfill-installs-browser.spec.ts`
Expected: PASS. (If it fails to find `?raw`, the import path is wrong; if `window.browser` never appears, the inline-module-script technique needs a longer `waitFor` timeout — bump to 1500 ms, still under the page test budget.)

- [ ] **Step 3: Commit**

```bash
git add test/ui/polyfill-installs-browser.spec.ts
git commit -m "test: pin verbatim-ESM polyfill self-install behavior"
```

---

## Task 2: Lock the build output with a failing test

Asserts the polyfill ships to Chrome as one external file and is fully gone from Firefox. RED until Tasks 3–5 land. Mirrors `test/build/no-turndown-in-chrome-background.test.ts`.

**Files:**
- Create: `test/build/no-polyfill-in-firefox.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const firefoxDist = path.join(root, 'firefox-mv3', 'dist');
const chromeDist = path.join(root, 'chrome', 'dist');

// `wrapAPIs` is internal to webextension-polyfill — present iff polyfill code is in a file.
const POLYFILL_MARKER = /wrapAPIs/;
// The external side-effect import emitted into each Chrome entry bundle.
const EXTERNAL_IMPORT = '/vendor/browser-polyfill.js';

const UI_ENTRIES = [
  'popup', 'options', 'options-permissions', 'permissions',
  'custom-format', 'check-custom-formats', 'built-in-style-options',
];

function htmlFiles(staticDir: string): string[] {
  return readdirSync(staticDir).filter((n) => n.endsWith('.html')).map((n) => path.join(staticDir, n));
}
function jsFiles(distDir: string): string[] {
  // background.js + ui/*.js (+ offscreen.js on chrome); recurse one level.
  const out: string[] = [];
  for (const name of readdirSync(distDir)) {
    const p = path.join(distDir, name);
    if (name.endsWith('.js')) out.push(p);
    else if (name === 'ui') for (const u of readdirSync(p)) if (u.endsWith('.js')) out.push(path.join(p, u));
  }
  return out;
}

describe('webextension-polyfill ships to chrome only', () => {
  beforeAll(() => {
    execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  }, 180_000);

  // --- Firefox: fully absent ---
  it('does not ship browser-polyfill.js to firefox vendor', () => {
    expect(existsSync(path.join(firefoxDist, 'vendor', 'browser-polyfill.js'))).toBe(false);
    expect(existsSync(path.join(firefoxDist, 'vendor', 'bulma.css'))).toBe(true);
  });
  it('has no polyfill code or external import anywhere in firefox JS', () => {
    for (const f of jsFiles(firefoxDist)) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(POLYFILL_MARKER);
      expect(src, f).not.toContain(EXTERNAL_IMPORT);
    }
  });
  it('has no polyfill <script> in any firefox HTML', () => {
    // Match the src path, not the bare filename: about.html mentions it in attribution.
    for (const f of htmlFiles(path.join(firefoxDist, 'static'))) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('vendor/browser-polyfill.js');
    }
  });

  // --- Chrome: one shared external file, never inlined ---
  it('ships browser-polyfill.js to chrome vendor with polyfill code', () => {
    const vendor = path.join(chromeDist, 'vendor', 'browser-polyfill.js');
    expect(existsSync(vendor)).toBe(true);
    expect(readFileSync(vendor, 'utf8')).toMatch(POLYFILL_MARKER);
  });
  it('does not inline polyfill code into any chrome bundle', () => {
    for (const f of jsFiles(chromeDist)) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(POLYFILL_MARKER);
    }
  });
  it('emits the external import in the SW and every UI entry bundle', () => {
    expect(readFileSync(path.join(chromeDist, 'background.js'), 'utf8')).toContain(EXTERNAL_IMPORT);
    for (const e of UI_ENTRIES) {
      expect(readFileSync(path.join(chromeDist, 'ui', `${e}.js`), 'utf8'), e).toContain(EXTERNAL_IMPORT);
    }
  });
  it('removes the classic polyfill <script> from chrome HTML', () => {
    for (const f of htmlFiles(path.join(chromeDist, 'static'))) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('vendor/browser-polyfill.js');
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (RED)**

Run: `npx vitest run --project unit test/build/no-polyfill-in-firefox.test.ts`
Expected: FAIL — today firefox still ships the vendor file + `wrapAPIs` in `background.js`; chrome inlines `wrapAPIs` into `background.js` and has no external import; HTML still has the `<script>`.

- [ ] **Step 3: Commit**

```bash
git add test/build/no-polyfill-in-firefox.test.ts
git commit -m "test: lock chrome-only shared-file polyfill build (red)"
```

---

## Task 3: Gate the vendor asset copy (Change 1)

**Files:**
- Modify: `scripts/build.js` (the `assets` array in `copyAssets()`, ~lines 62-65)

- [ ] **Step 1: Make the polyfill asset Chrome-only**

Replace the unconditional `assets` array in `copyAssets(t)`:

```js
  const assets = [
    { src: path.join(nodeModules, 'webextension-polyfill', 'dist', 'browser-polyfill.js'), dest: 'browser-polyfill.js' },
    { src: path.join(nodeModules, 'bulma', 'css', 'bulma.css'), dest: 'bulma.css' },
  ];
```

with:

```js
  // bulma ships to both targets; webextension-polyfill ships to Chrome only (Firefox
  // implements browser.* natively). Analogous to the offscreen.html exclusion above.
  const assets = [
    { src: path.join(nodeModules, 'bulma', 'css', 'bulma.css'), dest: 'bulma.css' },
  ];
  if (t === 'chrome') {
    assets.unshift({
      src: path.join(nodeModules, 'webextension-polyfill', 'dist', 'browser-polyfill.js'),
      dest: 'browser-polyfill.js',
    });
  }
```

- [ ] **Step 2: Verify per target**

Run: `node scripts/build.js firefox-mv3 && test ! -e firefox-mv3/dist/vendor/browser-polyfill.js && test -e firefox-mv3/dist/vendor/bulma.css && node scripts/build.js chrome && test -e chrome/dist/vendor/browser-polyfill.js && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/build.js
git commit -m "build: copy browser-polyfill.js to chrome target only"
```

---

## Task 4: External verbatim import + per-target resolution (Change 2)

**Files:**
- Modify: `src/ensure-browser-global.ts`
- Create: `src/shims/empty.js`
- Create: `src/types/vendor-polyfill.d.ts`
- Delete: `src/types/webextension-polyfill.d.ts`
- Modify: `scripts/build.js` (add the `onResolve` plugin + wire it into `buildOptions`)

- [ ] **Step 1: Rewrite `src/ensure-browser-global.ts`**

Replace the entire file contents with:

```ts
// Install the `browser.*` global for old Chrome (< 148), shared by the service worker
// and every UI entry.
//
// This is a side-effect import of the *verbatim* polyfill file shipped at
// `vendor/browser-polyfill.js` (Chrome only). Loaded as its own ES module, the
// polyfill's UMD wrapper takes its global-assignment branch (ESM scope has no
// CommonJS `exports`) and self-installs `globalThis.browser`. On modern Chrome and
// Firefox it is a no-op (it returns the existing native `browser`).
//
// esbuild keeps this import external for Chrome (one shared, cached file — never
// inlined) and redirects it to an empty module for Firefox, which implements
// `browser.*` natively and ships no polyfill file (see scripts/build.js).
//
// Every entry imports this module FIRST so `browser` exists before any module in the
// graph evaluates. Delete this file, the asset copy, and the per-entry imports once
// minimum_chrome_version >= 148.
import '/vendor/browser-polyfill.js';
```

- [ ] **Step 2: Create `src/shims/empty.js`**

```js
// Empty module. Firefox implements browser.* natively and ships no polyfill, so the
// `/vendor/browser-polyfill.js` side-effect import (Chrome only) is redirected here
// for the Firefox build (see the onResolve plugin in scripts/build.js).
export {};
```

- [ ] **Step 3: Create `src/types/vendor-polyfill.d.ts`**

```ts
// The Chrome build loads webextension-polyfill verbatim from its shipped location via
// a side-effect import (see src/ensure-browser-global.ts). It has no exports —
// importing it only runs the file to install `globalThis.browser`. This ambient
// declaration lets `tsc` accept the extension-root-absolute specifier.
declare module '/vendor/browser-polyfill.js';
```

- [ ] **Step 4: Delete the now-unused npm-package declaration**

Run: `git rm src/types/webextension-polyfill.d.ts`
Expected: file removed. (Nothing imports `'webextension-polyfill'` anymore — confirm with `grep -rn "from 'webextension-polyfill'" src` → no matches.)

- [ ] **Step 5: Add the `onResolve` plugin to `scripts/build.js`**

Just above `const buildOptions = {`, add:

```js
// webextension-polyfill ships to Chrome only, as ONE shared file referenced by a
// verbatim external import (`import '/vendor/browser-polyfill.js'`) from
// ensure-browser-global.ts. Chrome: keep it external so esbuild emits it as-is (the
// browser loads/caches the single file). Firefox: redirect to an empty module so
// nothing is imported and no bundle 404s. The leading-slash specifier resolves to the
// extension root at runtime, identically from entries at any directory depth.
const polyfillResolverPlugin = {
  name: 'polyfill-resolver',
  setup(build) {
    build.onResolve({ filter: /^\/vendor\/browser-polyfill\.js$/ }, () => (
      target === 'chrome'
        ? { path: '/vendor/browser-polyfill.js', external: true }
        : { path: path.join(srcDir, 'shims', 'empty.js') }
    ));
  },
};
```

Then add the plugin to `buildOptions` (e.g. immediately after the `define:` line):

```js
  define: { BUILD_TARGET: JSON.stringify(target) },
  plugins: [polyfillResolverPlugin],
```

- [ ] **Step 6: Build both targets and verify the polyfill placement**

Run:
```bash
node scripts/build.js chrome && node scripts/build.js firefox-mv3
echo "chrome bg has external import:"; grep -c "/vendor/browser-polyfill.js" chrome/dist/background.js
echo "chrome bg inlines polyfill (want 0):"; grep -c "wrapAPIs" chrome/dist/background.js
echo "chrome vendor has polyfill (want >0):"; grep -c "wrapAPIs" chrome/dist/vendor/browser-polyfill.js
echo "firefox bg has polyfill or import (want 0):"; grep -c "wrapAPIs\|/vendor/browser-polyfill.js" firefox-mv3/dist/background.js
```
Expected: chrome bg external import `1`; chrome bg inline `0`; chrome vendor `>0`; firefox bg `0`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (the `declare module '/vendor/browser-polyfill.js'` makes the import resolve for TS).

- [ ] **Step 8: Commit**

```bash
git add src/ensure-browser-global.ts src/shims/empty.js src/types/vendor-polyfill.d.ts scripts/build.js
git add -u src/types/webextension-polyfill.d.ts
git commit -m "build: load polyfill as one shared external file (chrome) / empty (firefox)"
```

---

## Task 5: Wire the UI entries + drop the HTML tags (Change 3) — turn the lock test green

**Files:**
- Modify: `src/ui/popup.ts`, `src/ui/options.ts`, `src/ui/options-permissions.ts`, `src/ui/permissions.ts`, `src/ui/custom-format.ts`, `src/ui/check-custom-formats.ts`, `src/ui/built-in-style-options.ts`
- Modify: `src/static/popup.html`, `options.html`, `options-permissions.html`, `permissions.html`, `custom-format.html`, `multiple-links.html`, `single-link.html`, `custom-format-help.html`

- [ ] **Step 1: Prepend the polyfill import to each of the 7 UI entries**

Insert this as the **very first line** of each of the 7 files listed above:

```ts
import '../ensure-browser-global.js'; // MUST be first — installs `browser` for old Chrome.
```

(`background.ts` already imports it first — do not change it. `offscreen.ts` is not in the list.)

- [ ] **Step 2: Delete the classic `<script>` from the 8 HTML pages**

Remove the line `<script src="../vendor/browser-polyfill.js"></script>` (any indentation) from each of the 8 HTML files listed above. Leave `about.html` untouched (it has no such tag, only the attribution `<h3>`).

Verify none remain in source:
Run: `grep -rl "vendor/browser-polyfill.js" src/static`
Expected: prints nothing (no files match).

- [ ] **Step 3: Build and run the lock test — now GREEN**

Run: `npx vitest run --project unit test/build/no-polyfill-in-firefox.test.ts`
Expected: PASS — all assertions green (firefox fully absent; chrome ships one external file, never inlined, imported by SW + all 7 UI entries; no HTML tags).

- [ ] **Step 4: Commit**

```bash
git add src/ui/*.ts src/static/*.html
git commit -m "feat: load browser-polyfill via entry import; drop classic <script>"
```

---

## Task 6: Full verification, manual smoke tests, PR note

**Files:**
- Create: `docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md`

- [ ] **Step 1: Typecheck, lint, full unit + browser tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all exit 0 (includes the new install-path and build-output tests).

- [ ] **Step 2: Chrome e2e (Docker — project convention)**

Run: `npm run test:e2e:docker`
Expected: Playwright suite green. (Known tab-exporting flake may need a re-run.)

- [ ] **Step 3: Manual Chrome smoke — resolution loud-failure check**

Build: `npm run build-chrome`. Load `chrome/` unpacked (`chrome://extensions` → Developer mode → Load unpacked → pick the `chrome/` dir). Open the service worker's console (Inspect views: service worker) and a page console.
  - Open the popup, copy the current tab as Markdown, paste to confirm.
  - Open the options page, change a setting, confirm it persists.
Expected: popup + options work; **no console error** and the **service worker is registered/active** — that is the proof `/vendor/browser-polyfill.js` resolved (a resolution failure would blank the popup / kill the SW, since it is the first import).

- [ ] **Step 4: Manual Firefox smoke test**

Build: `npm run build-firefox-mv3`. Load `firefox-mv3/` as a temporary add-on (`about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `firefox-mv3/manifest.json`). Open the Browser Console; confirm NO 404 for `browser-polyfill.js` and no `browser is not defined`. Exercise:
  - Popup copy (copy current tab as Markdown; paste to confirm).
  - Options page (change a setting; confirm it persists).
  - Permissions flow (trigger the all-tabs/all-urls permission request).
  - Selection → Markdown (select page text; Copy Selection as Markdown; paste to confirm).
Expected: all four work; no console errors referencing `browser` or a missing `browser-polyfill.js`.

- [ ] **Step 5: Write the PR note**

Write `docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md` summarizing: the 3c mechanism (one shared external file imported by every entry; esbuild `onResolve` external-for-chrome / empty-for-firefox; HTML tags dropped), why (Firefox has native `browser.*`), that Chrome is functionally identical (mechanism changed, single cached file kept), and the verification done (install-path test + build-output test + Chrome e2e + manual Chrome/Firefox smoke). Keep it short — it becomes the PR description.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md
git commit -m "docs: PR note for chrome-only browser-polyfill"
```

---

## Acceptance recap (from the spec)

- Firefox: no `vendor/browser-polyfill.js`; `grep wrapAPIs firefox-mv3/dist/**` → 0; no `/vendor/browser-polyfill.js` in any firefox JS; no firefox HTML references it. (Task 2 test.)
- Chrome: polyfill only in `vendor/browser-polyfill.js`, never inlined; external import in SW + all 7 UI entries; no HTML tags. (Task 2 test.)
- Verbatim-ESM self-install proven without old Chrome. (Task 1 test.)
- `typecheck` / `lint` / `test` green; Chrome e2e green. (Task 6 Steps 1-2.)
- Chrome resolution confirmed via loud-failure smoke; Firefox manually smoke-tested. (Task 6 Steps 3-4.)
- PR note written. (Task 6 Step 5.)
```
