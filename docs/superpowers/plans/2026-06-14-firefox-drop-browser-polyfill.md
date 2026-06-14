# Ship browser-polyfill to Chrome only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `webextension-polyfill` (`browser-polyfill.js`) ship to the Chrome build only and be fully absent from the Firefox build, while leaving the Chrome build byte-for-byte unchanged.

**Architecture:** The polyfill reaches the extension two ways — a copied `vendor/browser-polyfill.js` asset referenced by a classic `<script>` in 8 static HTML pages, and a bundled `import` in `src/ensure-browser-global.ts` inlined into `background.js`. We gate the asset copy and the bundled assignment on the build target, strip the `<script>` from Firefox's copied HTML in the build, and lock all three with a vitest build-output test mirroring the existing `no-turndown-in-chrome-background.test.ts`.

**Tech Stack:** Node + esbuild build (`scripts/build.js`), `BUILD_TARGET` compile-time `define`, vitest (unit project, node env).

---

## Context the worker needs

- **Branch:** already on `firefox-drop-browser-polyfill` (off `master`). Do not switch branches.
- **Spec:** `docs/superpowers/specs/2026-06-14-firefox-drop-browser-polyfill-design.md`.
- **Build commands:** `node scripts/build.js chrome` and `node scripts/build.js firefox-mv3` build into `chrome/dist/` and `firefox-mv3/dist/` respectively. `npm run build` does both. `BUILD_TARGET` is injected by esbuild's `define`; branches gated on it are dead-code-eliminated for the other target (idiom already used in `src/background.ts:50-65`).
- **Marker:** `wrapAPIs` is a function name internal to `webextension-polyfill`, unique to the polyfill source — the sentinel for "polyfill bytes are present".
- **HTML facts:** 8 pages carry `<script src="../vendor/browser-polyfill.js"></script>` (popup, options, options-permissions, custom-format, permissions, multiple-links, single-link, custom-format-help). `about.html` has only the *attribution* text (`<h3>browser-polyfill.js ...`), no script tag — leave it untouched. `offscreen.html` has no tag and is already excluded from Firefox. All HTML is top-level in `src/static/`.
- **`copyAssets(t)`** in `scripts/build.js` runs for both the one-shot build and the watch-mode re-copy (`onAssetChange`), so editing `copyAssets` covers watch mode automatically — no separate watch-path edit.
- **`webextension-polyfill`** is CommonJS and does NOT declare `"sideEffects": false`, so esbuild may retain the unused `import` after the assignment is DCE'd. Task 3 verifies this and applies the alias fallback only if needed.

---

## Task 1: Lock the behavior with a failing build test

**Files:**
- Create: `test/build/no-polyfill-in-firefox.test.ts`

This test builds both targets and asserts the polyfill is gone from Firefox but intact on Chrome. It will be RED until Tasks 2–4 land. Mirrors `test/build/no-turndown-in-chrome-background.test.ts`.

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

// `wrapAPIs` is a function internal to webextension-polyfill — present iff the
// polyfill code is bundled. Reliable sentinel for "polyfill bytes shipped".
const POLYFILL_MARKER = /wrapAPIs/;

function htmlFiles(staticDir: string): string[] {
  return readdirSync(staticDir)
    .filter((n) => n.endsWith('.html'))
    .map((n) => path.join(staticDir, n));
}

describe('firefox build drops webextension-polyfill', () => {
  beforeAll(() => {
    execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
  }, 180_000);

  it('does not copy browser-polyfill.js into the firefox vendor dir', () => {
    expect(existsSync(path.join(firefoxDist, 'vendor', 'browser-polyfill.js'))).toBe(false);
  });

  it('still copies bulma.css into the firefox vendor dir', () => {
    expect(existsSync(path.join(firefoxDist, 'vendor', 'bulma.css'))).toBe(true);
  });

  it('does not bundle polyfill code into firefox background.js', () => {
    const source = readFileSync(path.join(firefoxDist, 'background.js'), 'utf8');
    expect(source).not.toMatch(POLYFILL_MARKER);
  });

  it('strips the polyfill <script> from every firefox HTML page', () => {
    // Match the script src path, not the bare filename: about.html mentions
    // "browser-polyfill.js" in its attribution <h3>, which must stay.
    for (const file of htmlFiles(path.join(firefoxDist, 'static'))) {
      expect(readFileSync(file, 'utf8')).not.toContain('vendor/browser-polyfill.js');
    }
  });

  it('keeps the polyfill in the chrome build (guard against over-removal)', () => {
    expect(existsSync(path.join(chromeDist, 'vendor', 'browser-polyfill.js'))).toBe(true);
    expect(readFileSync(path.join(chromeDist, 'background.js'), 'utf8')).toMatch(POLYFILL_MARKER);
    const chromePopup = readFileSync(path.join(chromeDist, 'static', 'popup.html'), 'utf8');
    expect(chromePopup).toContain('vendor/browser-polyfill.js');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (RED)**

Run: `npx vitest run --project unit test/build/no-polyfill-in-firefox.test.ts`
Expected: FAIL — the firefox vendor file exists, `background.js` matches `wrapAPIs`, and firefox HTML still contains `browser-polyfill.js`. (The chrome guard assertion passes.)

- [ ] **Step 3: Commit**

```bash
git add test/build/no-polyfill-in-firefox.test.ts
git commit -m "test: lock firefox-drops-polyfill build behavior (red)"
```

---

## Task 2: Gate the vendor asset copy (Change 1)

**Files:**
- Modify: `scripts/build.js` (the `assets` array in `copyAssets()`, ~lines 62-65)

- [ ] **Step 1: Make the polyfill asset Chrome-only**

In `copyAssets(t)`, replace the unconditional `assets` array:

```js
  const assets = [
    { src: path.join(nodeModules, 'webextension-polyfill', 'dist', 'browser-polyfill.js'), dest: 'browser-polyfill.js' },
    { src: path.join(nodeModules, 'bulma', 'css', 'bulma.css'), dest: 'bulma.css' },
  ];
```

with a target-gated build of the array:

```js
  // bulma ships to both targets; the webextension-polyfill ships to Chrome only
  // (Firefox implements browser.* natively). Analogous to the offscreen.html
  // exclusion above.
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

- [ ] **Step 2: Build Firefox and verify the asset is gone**

Run: `node scripts/build.js firefox-mv3 && test ! -e firefox-mv3/dist/vendor/browser-polyfill.js && test -e firefox-mv3/dist/vendor/bulma.css && echo OK`
Expected: prints `OK` (polyfill absent, bulma present).

- [ ] **Step 3: Build Chrome and verify the asset still ships**

Run: `node scripts/build.js chrome && test -e chrome/dist/vendor/browser-polyfill.js && echo OK`
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add scripts/build.js
git commit -m "build: copy browser-polyfill.js to chrome target only"
```

---

## Task 3: Gate the bundled assignment, verify, fall back to alias if needed (Change 2)

**Files:**
- Modify: `src/ensure-browser-global.ts`
- (Conditional fallback) Create: `src/shims/webextension-polyfill-empty.js`
- (Conditional fallback) Modify: `scripts/build.js` (`buildOptions`)

- [ ] **Step 1: Gate the assignment on `BUILD_TARGET`**

In `src/ensure-browser-global.ts`, wrap the assignment (currently the last line):

```ts
import browserPolyfill from 'webextension-polyfill';

if (BUILD_TARGET === 'chrome') {
  (globalThis as any).browser ??= browserPolyfill;
}
```

Leave the `import` line and the explanatory comment block above it as-is. (The `import` cannot be gated; Step 2 checks whether esbuild drops it.)

- [ ] **Step 2: Build Firefox and grep the background bundle for the marker**

Run: `node scripts/build.js firefox-mv3 && grep -c "wrapAPIs" firefox-mv3/dist/background.js; echo "exit=$?"`
Expected (success): prints `0`. If it prints a number > 0, esbuild retained the CommonJS import — proceed to Step 3 (alias fallback). If `0`, **skip Steps 3-4** and go to Step 5.

- [ ] **Step 3 (only if Step 2 marker > 0): Create the empty stub**

Create `src/shims/webextension-polyfill-empty.js`:

```js
// Empty stand-in for `webextension-polyfill` in the Firefox build.
//
// Firefox implements `browser.*` natively, so the polyfill is never used there.
// esbuild's `alias` (Firefox target only, in scripts/build.js) maps the
// `webextension-polyfill` import to this file so no polyfill bytes are bundled.
// The `??=` assignment in ensure-browser-global.ts is gated on
// `BUILD_TARGET === 'chrome'`, so this default export is never read at runtime
// on Firefox.
export default {};
```

- [ ] **Step 4 (only if Step 2 marker > 0): Alias the package for Firefox in `scripts/build.js`**

In `buildOptions`, add an `alias` key (after the `target:` line):

```js
  target: target === 'chrome' ? ['chrome116'] : ['firefox139'],
  // Firefox doesn't need webextension-polyfill (native browser.*); alias it to an
  // empty module so no polyfill bytes are bundled even though the import survives
  // tree-shaking (the npm package is CommonJS without `sideEffects: false`).
  alias: target === 'firefox-mv3'
    ? { 'webextension-polyfill': path.join(srcDir, 'shims', 'webextension-polyfill-empty.js') }
    : undefined,
  logLevel: 'info',
```

Then re-run Step 2's command and confirm it now prints `0`.

- [ ] **Step 5: Verify Chrome still bundles the polyfill and behaves identically**

Run: `node scripts/build.js chrome && grep -c "wrapAPIs" chrome/dist/background.js`
Expected: prints a number > 0 (polyfill still bundled for Chrome).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors. (Confirms the gated `BUILD_TARGET` reference and, if added, the alias/stub typecheck cleanly.)

- [ ] **Step 7: Commit**

```bash
git add src/ensure-browser-global.ts
# include the next two only if the fallback was applied:
git add src/shims/webextension-polyfill-empty.js scripts/build.js 2>/dev/null
git commit -m "build: drop webextension-polyfill from firefox background bundle"
```

---

## Task 4: Strip the polyfill `<script>` from Firefox HTML (Change 3) and turn the test green

**Files:**
- Modify: `scripts/build.js` (`copyAssets()`)

- [ ] **Step 1: Add the strip helper and call it for Firefox**

In `scripts/build.js`, add a helper function (place it just above `copyAssets`):

```js
// Firefox ships no browser-polyfill.js (native browser.*), so its copied HTML must
// not reference the (now absent) classic <script>, or every page 404s. Strip the
// tag — including any leading indentation and trailing newline — from the copied
// HTML. Runs only for the firefox-mv3 target; Chrome HTML is left untouched.
const POLYFILL_SCRIPT_TAG = /^[ \t]*<script[^>]*src="[^"]*browser-polyfill\.js"[^>]*>\s*<\/script>[ \t]*\r?\n?/gm;
function stripFirefoxPolyfillScript(staticDir) {
  for (const name of fs.readdirSync(staticDir)) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(staticDir, name);
    const html = fs.readFileSync(file, 'utf8');
    const stripped = html.replace(POLYFILL_SCRIPT_TAG, '');
    if (stripped !== html) fs.writeFileSync(file, stripped);
  }
}
```

Then, inside `copyAssets(t)`, immediately after the `fs.cpSync(... 'static' ...)` call that copies the static dir, add:

```js
  if (t === 'firefox-mv3') {
    stripFirefoxPolyfillScript(path.join(outdir, 'static'));
  }
```

- [ ] **Step 2: Build Firefox and verify no HTML references the polyfill**

Run: `node scripts/build.js firefox-mv3 && grep -rl "vendor/browser-polyfill.js" firefox-mv3/dist/static; echo "exit=$?"`
Expected: prints nothing (no files matched) followed by `exit=1` (grep found nothing). Note: `about.html` still contains the bare string `browser-polyfill.js` in its attribution text — that is intentional and is why this grep matches the `vendor/` src path, not the bare filename.

- [ ] **Step 3: Build Chrome and verify its HTML still has the tag**

Run: `node scripts/build.js chrome && grep -c "vendor/browser-polyfill.js" chrome/dist/static/popup.html`
Expected: prints `1`.

- [ ] **Step 4: Run the build test — now GREEN**

Run: `npx vitest run --project unit test/build/no-polyfill-in-firefox.test.ts`
Expected: PASS — all assertions green (firefox: no vendor file, bulma present, no `wrapAPIs` in background.js, no HTML reference; chrome: polyfill intact).

- [ ] **Step 5: Commit**

```bash
git add scripts/build.js
git commit -m "build: strip browser-polyfill <script> from firefox HTML"
```

---

## Task 5: Full verification, manual Firefox smoke test, PR note

**Files:**
- Create: `docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md` (PR note draft)

- [ ] **Step 1: Typecheck, lint, full unit tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all exit 0. The new `no-polyfill-in-firefox.test.ts` passes alongside the existing suite.

- [ ] **Step 2: Confirm the Chrome build is unchanged vs master**

Run:
```bash
npm run build
git stash --include-untracked --quiet 2>/dev/null
git worktree add -q /tmp/cam-master master && (cd /tmp/cam-master && npm ci --silent && npm run build-chrome >/dev/null 2>&1)
diff -r chrome/dist /tmp/cam-master/chrome/dist; echo "chrome-diff-exit=$?"
git worktree remove --force /tmp/cam-master
git stash pop --quiet 2>/dev/null || true
```
Expected: `chrome-diff-exit=0` (no differences — Chrome `dist` identical to master). If `npm ci` in the worktree is impractical, instead diff only the polyfill-relevant outputs: confirm `chrome/dist/vendor/browser-polyfill.js`, `chrome/dist/background.js`, and `chrome/dist/static/*.html` are unchanged from `git show master:` equivalents where tracked, and note that Chrome asset/HTML/bundle were not modified by any task.

- [ ] **Step 3: Chrome e2e (Docker — required by project convention)**

Run: `npm run test:e2e:docker`
Expected: Playwright suite green. (Note: a known tab-exporting flake exists; re-run if only that fails.)

- [ ] **Step 4: Manual Firefox smoke test**

Build and load the Firefox build, then exercise each path. Build: `npm run build-firefox-mv3`. Load `firefox-mv3/` as a temporary add-on (`about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `firefox-mv3/manifest.json`), open the Browser Console, and verify NO `browser is not defined` / 404 for `browser-polyfill.js`. Exercise:
  - Popup copy (open popup, copy current tab as Markdown; paste to confirm).
  - Options page (open, change a setting, confirm it persists).
  - Permissions flow (trigger the all-tabs/all-urls permission request).
  - Selection → Markdown (select page text, run Copy Selection as Markdown; paste to confirm).

Expected: all four work; no console errors referencing `browser` or a missing `browser-polyfill.js`.

- [ ] **Step 5: Write the PR note**

Write `docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md` summarizing: what changed (3 coordinated changes), why (Firefox has native `browser.*`), that Chrome is unchanged, whether the alias fallback was needed, and the verification performed (test + Chrome e2e + manual Firefox smoke). Keep it short (the body becomes the PR description).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/2026-06-14-firefox-drop-browser-polyfill-pr-note.md
git commit -m "docs: PR note for firefox-drops-polyfill"
```

---

## Acceptance recap (from the spec)

- `firefox-mv3/dist/vendor/browser-polyfill.js` absent; no Firefox HTML references it; `grep wrapAPIs firefox-mv3/dist/** ` → 0. (Task 4 test.)
- Chrome `dist` unchanged. (Task 5 Step 2.)
- `typecheck` / `lint` / `test` green; Chrome e2e green. (Task 5 Steps 1, 3.)
- Firefox build manually smoke-tested. (Task 5 Step 4.)
- PR note written. (Task 5 Step 5.)
