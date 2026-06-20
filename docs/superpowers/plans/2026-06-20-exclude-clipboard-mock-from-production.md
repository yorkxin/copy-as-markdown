# Exclude Clipboard Mock From Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the e2e-only clipboard mock ABSENT from production extension bundles (Chrome + Firefox) via dead-code elimination, while keeping it fully present in the e2e test build, with production runtime behavior unchanged.

**Architecture:** Add a second, orthogonal compile-time define `BUILD_PROFILE` (`'production' | 'e2e'`) alongside the existing `BUILD_TARGET`. esbuild defaults it to `'production'`; vitest defines it as `'e2e'`. Every mock touch-point is gated on `BUILD_PROFILE === 'e2e'` so esbuild constant-folds and tree-shakes the mock out of production. The e2e build is rewritten to compile each test dir DIRECTLY with `profile: 'e2e'` (no copy of production output). A build-time assertion + a unit-runnable build test stand guard that production bundles never carry the mock.

**Tech Stack:** Node ESM build scripts, esbuild (bundling + `define` + tree-shaking), TypeScript (ambient `declare const`), Vitest 4 (project-scoped `define`), Playwright (e2e, Docker).

**Spec:** `docs/superpowers/specs/2026-06-09-exclude-clipboard-mock-from-production-design.md`

**Confirmed refinements (vs. spec text):**
- The assertion script is **parameterized by target** (`assert-no-clipboard-mock.js <chrome|firefox-mv3>`), scanning only that target's `dist`, wired per-build — avoids `build-chrome` scanning a stale/absent `firefox-mv3/dist`.
- The vitest `BUILD_PROFILE` define is set **per-project** (both `unit` and `browser`), not root-level, because root-level config does not propagate into `test.projects` (the config already duplicates `resolve.alias` per project for this reason).

**Critical gotchas (read before starting):**
1. **Scan `.js` only, never `.js.map`.** Sourcemaps embed the full original `clipboard-service.ts` via `sourcesContent` (including the tree-shaken mock), so scanning `.js.map` would false-positive. `.endsWith('.js')` already excludes `.js.map`.
2. **All three sentinels live only in `clipboard-service.ts`.** Gating that file alone makes the production guard pass; `background.ts`/`popup.ts` gating removes other dead machinery (no sentinels) and is verified by e2e, not the guard.
3. **e2e is temporarily broken between Task 4 and Task 6.** After gating, production `chrome/dist` has no mock; the OLD copy-based `build-test-extension.js` would copy that mock-free output into `chrome-test/`. Do NOT run e2e until Task 6 (the direct-compile rewrite) lands.
4. **The build tests shell out to `node scripts/build.js`** (a child process), which compiles with esbuild's `BUILD_PROFILE='production'` default — independent of vitest's `'e2e'` define. That's why the same source yields a mock-free production bundle but mock-bearing test code.

---

## File Structure

**New files:**
- `src/types/build-profile.d.ts` — ambient `declare const BUILD_PROFILE` for tsc/eslint.
- `scripts/lib/build-extension.js` — reusable `buildExtension({ target, outdir, profile, watch })`; the single home for all esbuild bundling + asset copy logic.
- `scripts/assert-no-clipboard-mock.js` — target-parameterized production guard script.
- `test/build/build-profile-define.test.ts` — proves vitest defines `BUILD_PROFILE='e2e'` (guards the per-project define).
- `test/build/no-clipboard-mock-in-production.test.ts` — proves production `dist` JS carries no mock sentinel.

**Modified files:**
- `scripts/build.js` — thin CLI wrapper over `buildExtension` (`profile: 'production'`).
- `scripts/build-test-extension.js` — compile each variant dir directly with `profile: 'e2e'`; derive manifest from the tracked source platform manifest; no prod copy.
- `src/services/clipboard-service.ts` — gate the controller's mock machinery on `BUILD_PROFILE === 'e2e'`.
- `src/background.ts` — gate the mock globals, the startup `initializeMockState()` call, and the two mock message handlers.
- `src/ui/popup.ts` — gate `useMockClipboard` init + the mock copy branch.
- `vitest.config.ts` — per-project `define: { BUILD_PROFILE: 'e2e' }`.
- `package.json` — wire `assert-no-clipboard-mock.js` into `build-chrome`/`build-firefox-mv3`; drop `npm run build &&` from `test:e2e:build`.

---

## Task 1: `BUILD_PROFILE` define plumbing

Establish the new compile-time define everywhere (tsc, esbuild, vitest) with NO gating yet. Pure infrastructure; the failing test proves the per-project vitest define propagates.

**Files:**
- Create: `src/types/build-profile.d.ts`
- Create: `test/build/build-profile-define.test.ts`
- Modify: `vitest.config.ts`
- Modify: `scripts/build.js:111` (the esbuild `define`)

- [ ] **Step 1: Write the failing test**

Create `test/build/build-profile-define.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// BUILD_PROFILE is an esbuild/vitest compile-time define. In the test runner it MUST be
// 'e2e' so the mock-bearing branches compile and the unit suite exercises them. This guards
// the per-project define in vitest.config.ts (root-level config does not reach test.projects).
describe('BUILD_PROFILE compile-time define', () => {
  it('is defined as "e2e" in the vitest unit project', () => {
    expect(BUILD_PROFILE).toBe('e2e');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/build/build-profile-define.test.ts --project unit`
Expected: FAIL — `BUILD_PROFILE is not defined` (ReferenceError) and/or tsc-level "Cannot find name 'BUILD_PROFILE'".

- [ ] **Step 3: Add the ambient declaration**

Create `src/types/build-profile.d.ts`:

```ts
/**
 * Injected by esbuild's `define` at build time (see scripts/lib/build-extension.js) and by
 * vitest's per-project `define` (see vitest.config.ts).
 * `'production'` strips the e2e-only clipboard mock from the bundle; `'e2e'` keeps it.
 * Orthogonal to BUILD_TARGET (platform). Branches gated on this constant are
 * dead-code-eliminated in production builds.
 */
declare const BUILD_PROFILE: 'production' | 'e2e';
```

- [ ] **Step 4: Add the per-project vitest define**

In `vitest.config.ts`, add a `define` sibling to `resolve`/`test` in BOTH projects. The `unit` project becomes:

```ts
      {
        resolve: { alias: polyfillAlias },
        define: { BUILD_PROFILE: JSON.stringify('e2e') },
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/ui/**/*.spec.ts'],
          environment: 'node',
        },
      },
```

and the `browser` project becomes:

```ts
      {
        resolve: { alias: polyfillAlias },
        define: { BUILD_PROFILE: JSON.stringify('e2e') },
        test: {
          name: 'browser',
          include: ['test/ui/**/*.spec.ts', 'test/lib/**/*.spec.ts'],
          testTimeout: 1000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
```

- [ ] **Step 5: Add the esbuild define (default `'production'`)**

In `scripts/build.js`, change the `define` line (currently `define: { BUILD_TARGET: JSON.stringify(target) },`) to:

```js
  define: { BUILD_TARGET: JSON.stringify(target), BUILD_PROFILE: JSON.stringify('production') },
```

(Task 5 parameterizes this; for now the production CLI hardcodes `'production'`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/build/build-profile-define.test.ts --project unit`
Expected: PASS.

- [ ] **Step 7: Run the full gate (no behavior change expected)**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green. `BUILD_PROFILE` is defined but unreferenced in `src/`, so production output is unchanged and the existing `assert-no-turndown` still passes.

- [ ] **Step 8: Commit**

```bash
git add src/types/build-profile.d.ts test/build/build-profile-define.test.ts vitest.config.ts scripts/build.js
git commit -m "build: add orthogonal BUILD_PROFILE compile-time define"
```

---

## Task 2: Production guard + gate `clipboard-service.ts`

Write the production-mock guard (assertion script + build test) — it fails RED because the mock is still bundled — then gate the controller's mock machinery so it goes GREEN, and wire the assertion into the build.

**Files:**
- Create: `scripts/assert-no-clipboard-mock.js`
- Create: `test/build/no-clipboard-mock-in-production.test.ts`
- Modify: `src/services/clipboard-service.ts` (lines 138-143, 145-151, 163-170, 172-192, 204)
- Modify: `package.json` (`build-chrome`, `build-firefox-mv3` scripts)
- Test: `test/services/clipboard-service.test.ts` (existing — must stay green)

- [ ] **Step 1: Write the assertion script**

Create `scripts/assert-no-clipboard-mock.js`:

```js
#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const root = path.join(import.meta.dirname, '..');
const target = process.argv[2]; // 'chrome' | 'firefox-mv3'

if (target !== 'chrome' && target !== 'firefox-mv3') {
  console.error('✗ usage: node scripts/assert-no-clipboard-mock.js <chrome|firefox-mv3>');
  process.exit(1);
}

const distDir = path.join(root, target, 'dist');
if (!fs.existsSync(distDir)) {
  console.error(`✗ ${distDir} not found — run \`node scripts/build.js ${target}\` first`);
  process.exit(1);
}

// Strings that exist ONLY in the e2e clipboard mock: the storage key, the E2E global, and
// the factory name. The build never minifies, so a leaked mock keeps these verbatim.
const SENTINELS = ['mockClipboardCalls', '__mockClipboardService', 'createMockClipboardService'];

// .js ONLY — never .js.map: the sourcemap's `sourcesContent` embeds the full original
// clipboard-service.ts (including the tree-shaken mock), which is expected and not shipped logic.
function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of jsFiles(distDir)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const sentinel of SENTINELS) {
    if (source.includes(sentinel)) {
      offenders.push(`${path.relative(root, file)} (matched: ${sentinel})`);
    }
  }
}

if (offenders.length > 0) {
  console.error(`✗ clipboard mock leaked into ${target}/dist:`);
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('  The e2e-only clipboard mock must be DCE-stripped from production bundles.');
  process.exit(1);
}
console.log(`✓ ${target}/dist is free of the clipboard mock`);
```

- [ ] **Step 2: Write the build test**

Create `test/build/no-clipboard-mock-in-production.test.ts`:

```ts
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const chromeDist = path.join(root, 'chrome', 'dist');
const firefoxDist = path.join(root, 'firefox-mv3', 'dist');

// Strings that appear ONLY in the e2e clipboard mock. The build never minifies, so a leaked
// mock would keep these verbatim in the production bundle.
const SENTINELS = ['mockClipboardCalls', '__mockClipboardService', 'createMockClipboardService'];

// .js ONLY — never .js.map: the sourcemap embeds the full original clipboard-service.ts
// (including the tree-shaken mock) via sourcesContent, which would false-positive.
function jsFiles(distDir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(distDir)) {
    const p = path.join(distDir, name);
    if (name.endsWith('.js')) {
      out.push(p);
    } else if (name === 'ui') {
      for (const u of readdirSync(p)) {
        if (u.endsWith('.js')) out.push(path.join(p, u));
      }
    }
  }
  return out;
}

describe('production bundles exclude the clipboard mock', () => {
  beforeAll(() => {
    // Production builds (esbuild define BUILD_PROFILE='production') in a child process —
    // independent of vitest's 'e2e' define for this test file.
    execSync('node scripts/build.js chrome', { cwd: root, stdio: 'inherit' });
    execSync('node scripts/build.js firefox-mv3', { cwd: root, stdio: 'inherit' });
  }, 180_000);

  for (const [label, dist] of [['chrome', chromeDist], ['firefox-mv3', firefoxDist]] as const) {
    it(`has no clipboard-mock sentinel anywhere in ${label} JS`, () => {
      for (const f of jsFiles(dist)) {
        const src = readFileSync(f, 'utf8');
        for (const sentinel of SENTINELS) {
          expect(src, `${f} contains "${sentinel}"`).not.toContain(sentinel);
        }
      }
    });
  }
});
```

- [ ] **Step 3: Run the build test to verify it fails**

Run: `npx vitest run test/build/no-clipboard-mock-in-production.test.ts --project unit`
Expected: FAIL — `chrome/dist/background.js contains "createMockClipboardService"` (and the other sentinels). The mock is still bundled.

- [ ] **Step 4: Gate the controller mock machinery**

In `src/services/clipboard-service.ts`, make these five edits (all inside `createBrowserClipboardServiceController`).

`activeService` (lines 138-143):

```ts
  function activeService(): ClipboardService {
    if (BUILD_PROFILE === 'e2e' && mockMode) {
      return (mockService ??= createMockClipboardService());
    }
    return realService;
  }
```

`syncGlobalMockService` (lines 145-151) — add the early return:

```ts
  function syncGlobalMockService(): void {
    if (BUILD_PROFILE !== 'e2e') return;
    if (mockMode) {
      (globalThis as any).__mockClipboardService = (mockService ??= createMockClipboardService());
    } else if ((globalThis as any).__mockClipboardService) {
      delete (globalThis as any).__mockClipboardService;
    }
  }
```

`setMockMode` (lines 163-170) — add the early return as the first line:

```ts
  async function setMockMode(enabled: boolean): Promise<void> {
    if (BUILD_PROFILE !== 'e2e') return;
    if (mockMode !== enabled) {
      mockMode = enabled;
      syncGlobalMockService();
    }

    await persistMockState();
  }
```

`initializeMockState` (lines 172-192) — add the early return as the first line:

```ts
  async function initializeMockState(): Promise<void> {
    if (BUILD_PROFILE !== 'e2e') return;
    try {
      const stored = await storageArea.get(storageKey);
      const storedValue = stored[storageKey];
      if (typeof storedValue === 'boolean') {
        if (storedValue !== mockMode) {
          await setMockMode(storedValue);
        } else {
          await persistMockState();
        }
        return;
      }

      await storageArea.set({ [storageKey]: defaultMockState });
      if (mockMode !== defaultMockState) {
        await setMockMode(defaultMockState);
      }
    } catch (error) {
      console.error('Failed to initialize mock clipboard state', error);
    }
  }
```

`isMockMode` in the returned object (line 204):

```ts
    isMockMode: () => (BUILD_PROFILE === 'e2e' ? mockMode : false),
```

(Leave `createMockClipboardService`, `MockClipboardService`, and `createNavigatorClipboardService` exported and otherwise unchanged — unit tests import them, and they tree-shake from production once unreferenced.)

- [ ] **Step 5: Run the build test to verify it passes**

Run: `npx vitest run test/build/no-clipboard-mock-in-production.test.ts --project unit`
Expected: PASS — both chrome and firefox-mv3 dist are mock-free.

- [ ] **Step 6: Verify the existing unit suite still passes (e2e branch intact)**

Run: `npx vitest run test/services/clipboard-service.test.ts --project unit`
Expected: PASS — under vitest's `BUILD_PROFILE='e2e'`, `setMockMode`/`isMockMode`/`__mockClipboardService` behave exactly as before.

- [ ] **Step 7: Wire the assertion into the build scripts**

In `package.json`, update the two build scripts:

```json
    "build-chrome": "node scripts/build.js chrome && node scripts/assert-no-turndown.js && node scripts/assert-no-clipboard-mock.js chrome",
    "build-firefox-mv3": "node scripts/build.js firefox-mv3 && node scripts/assert-no-clipboard-mock.js firefox-mv3",
```

- [ ] **Step 8: Run the build with the assertion**

Run: `npm run build`
Expected: both targets build, and both print `✓ <target>/dist is free of the clipboard mock`.

- [ ] **Step 9: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (typecheck/eslint see both branches live, so no unreachable/unused errors).

- [ ] **Step 10: Commit**

```bash
git add scripts/assert-no-clipboard-mock.js test/build/no-clipboard-mock-in-production.test.ts src/services/clipboard-service.ts package.json
git commit -m "build: strip clipboard mock from production via BUILD_PROFILE gate + guard"
```

---

## Task 3: Gate `background.ts` mock touch-points

Remove the remaining mock wiring (globals, startup call, two message handlers) from production. These carry no sentinel, so the guard is unaffected; verification is typecheck/lint/build/unit staying green plus the production guard still passing.

**Files:**
- Modify: `src/background.ts` (lines 60-63, 201-204, 246-251)

- [ ] **Step 1: Gate the mock globals + startup init**

In `src/background.ts`, replace lines 60-63:

```ts
(globalThis as any).setMockClipboardMode = clipboardService.setMockMode;

clipboardService.initializeMockState()
  .catch(error => console.error('Mock clipboard init error', error));
```

with:

```ts
if (BUILD_PROFILE === 'e2e') {
  (globalThis as any).setMockClipboardMode = clipboardService.setMockMode;

  clipboardService.initializeMockState()
    .catch(error => console.error('Mock clipboard init error', error));
}
```

- [ ] **Step 2: Gate the `check-mock-clipboard` handler**

Replace the handler condition (line 201):

```ts
  if (runtimeMessage.topic === 'check-mock-clipboard') {
```

with:

```ts
  if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'check-mock-clipboard') {
```

- [ ] **Step 3: Gate the `set-mock-clipboard` handler**

Replace the handler condition (line 246):

```ts
  if (runtimeMessage.topic === 'set-mock-clipboard') {
```

with:

```ts
  if (BUILD_PROFILE === 'e2e' && runtimeMessage.topic === 'set-mock-clipboard') {
```

- [ ] **Step 4: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green; both `✓ <target>/dist is free of the clipboard mock` lines print.

- [ ] **Step 5: Commit**

```bash
git add src/background.ts
git commit -m "build: gate background.ts clipboard-mock wiring on BUILD_PROFILE"
```

---

## Task 4: Gate `popup.ts` mock branch

Strip `checkMockClipboardAvailable` and the mock copy path from the production popup; production keeps `navigator.clipboard.writeText`. The browser project's `BUILD_PROFILE='e2e'` define is exercised here — if it were missing, `popup.spec.ts` would throw `BUILD_PROFILE is not defined`.

**Files:**
- Modify: `src/ui/popup.ts` (line 132, line 395)
- Test: `test/ui/popup.spec.ts` (existing — must stay green)

- [ ] **Step 1: Gate the mock copy branch in `handleExportResponse`**

In `src/ui/popup.ts`, replace line 132:

```ts
  if (useMockClipboard) {
```

with:

```ts
  if (BUILD_PROFILE === 'e2e' && useMockClipboard) {
```

- [ ] **Step 2: Gate the `useMockClipboard` initialization**

Replace line 395:

```ts
      useMockClipboard = await checkMockClipboardAvailable();
```

with:

```ts
      useMockClipboard = BUILD_PROFILE === 'e2e' ? await checkMockClipboardAvailable() : false;
```

(In production, `useMockClipboard` is constant `false`, the mock branch DCEs, and `checkMockClipboardAvailable` tree-shakes.)

- [ ] **Step 3: Run the popup browser tests**

Run: `npx vitest run test/ui/popup.spec.ts --project browser`
Expected: PASS — under `BUILD_PROFILE='e2e'`, the `check-mock-clipboard` round-trip the spec mocks still runs.

- [ ] **Step 4: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green; both mock-free assertions print.

- [ ] **Step 5: Commit**

```bash
git add src/ui/popup.ts
git commit -m "build: gate popup clipboard-mock branch on BUILD_PROFILE"
```

---

## Task 5: Factor `buildExtension` out of `build.js`

Move all esbuild bundling + asset-copy logic into a reusable module so the e2e build (Task 6) can compile directly. `build.js` becomes a thin CLI. Production output must be byte-for-byte equivalent (the build tests re-verify).

**Files:**
- Create: `scripts/lib/build-extension.js`
- Modify: `scripts/build.js` (replace whole file)

- [ ] **Step 1: Create the reusable module**

Create `scripts/lib/build-extension.js` (logic lifted verbatim from the current `build.js`, parameterized by `outdir`/`profile`, with `root` resolved one extra level up):

```js
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..');
const srcDir = path.join(root, 'src');

// Entry points loaded by the manifest (background, offscreen) and by src/static/*.html.
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

function entryPointsFor(target) {
  const entries = [...sharedEntries];
  // Firefox has no offscreen API; only Chrome ships the offscreen document.
  if (target === 'chrome') entries.push('src/offscreen.ts');
  return entries.map(e => path.join(root, e));
}

function copyAssets(target, outdir) {
  fs.cpSync(path.join(srcDir, 'static'), path.join(outdir, 'static'), {
    recursive: true,
    filter: (src) => {
      if (target === 'firefox-mv3' && path.basename(src) === 'offscreen.html') return false;
      return true;
    },
  });
  const vendorDest = path.join(outdir, 'vendor');
  fs.mkdirSync(vendorDest, { recursive: true });
  const nodeModules = path.join(root, 'node_modules');
  const assets = [
    { src: path.join(nodeModules, 'bulma', 'css', 'bulma.css'), dest: 'bulma.css' },
  ];
  if (target === 'chrome') {
    assets.unshift({
      src: path.join(nodeModules, 'webextension-polyfill', 'dist', 'browser-polyfill.js'),
      dest: 'browser-polyfill.js',
    });
  }
  for (const { src, dest } of assets) {
    fs.copyFileSync(src, path.join(vendorDest, dest));
  }
}

function polyfillResolverPlugin(target) {
  return {
    name: 'polyfill-resolver',
    setup(build) {
      build.onResolve({ filter: /^\/dist\/vendor\/browser-polyfill\.js$/ }, () => (
        target === 'chrome'
          ? { path: '/dist/vendor/browser-polyfill.js', external: true }
          : { path: path.join(srcDir, 'shims', 'empty.js') }
      ));
    },
  };
}

/**
 * Build one extension target into `outdir`.
 * @param {{ target: 'chrome'|'firefox-mv3', outdir: string, profile?: 'production'|'e2e', watch?: boolean }} opts
 * @returns {Promise<import('esbuild').BuildContext|undefined>} the watch context when watch=true
 */
export async function buildExtension({ target, outdir, profile = 'production', watch = false }) {
  if (target !== 'chrome' && target !== 'firefox-mv3') {
    throw new Error(`unsupported target: ${target} (expected 'chrome' or 'firefox-mv3')`);
  }

  const buildOptions = {
    entryPoints: entryPointsFor(target),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    splitting: false,
    treeShaking: true,
    outdir,
    outbase: srcDir,
    sourcemap: 'linked',
    sourcesContent: true,
    minify: false,
    legalComments: 'eof',
    define: { BUILD_TARGET: JSON.stringify(target), BUILD_PROFILE: JSON.stringify(profile) },
    plugins: [polyfillResolverPlugin(target)],
    target: target === 'chrome' ? ['chrome116'] : ['firefox139'],
    logLevel: 'info',
  };

  // esbuild does NOT clean the outdir; remove stale files first for deterministic output.
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });

  // chrome/dist & firefox-mv3/dist are gitignored EXCEPT a tracked `.keep`. The rmSync
  // deletes it; recreate it so production builds leave a clean git status. (Harmless in
  // the gitignored *-test dirs.)
  const restoreKeep = () => fs.writeFileSync(path.join(outdir, '.keep'), '');

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    copyAssets(target, outdir);
    restoreKeep();
    const onAssetChange = () => {
      try {
        copyAssets(target, outdir);
        restoreKeep();
      } catch (err) {
        console.error('[build] asset re-copy failed:', err);
      }
    };
    try {
      fs.watch(path.join(srcDir, 'static'), { recursive: true }, onAssetChange);
    } catch (err) {
      console.warn(`[build] could not watch static for asset changes (${err.code ?? err.message}); `
        + 'static/vendor live-recopy disabled — JS rebuilds still work.');
    }
    console.log(`[build] watching ${target} ...`);
    return ctx;
  }

  await esbuild.build(buildOptions);
  copyAssets(target, outdir);
  restoreKeep();
  console.log(`[build] built ${target} (profile: ${profile})`);
  return undefined;
}
```

- [ ] **Step 2: Replace `scripts/build.js` with a thin wrapper**

Overwrite `scripts/build.js`:

```js
#!/usr/bin/env node
import * as path from 'node:path';
import process from 'node:process';
import { buildExtension } from './lib/build-extension.js';

const root = path.join(import.meta.dirname, '..');
const target = process.argv[2]; // 'chrome' | 'firefox-mv3'
const watch = process.argv.includes('--watch');

await buildExtension({
  target,
  outdir: path.join(root, target, 'dist'),
  profile: 'production',
  watch,
});
```

- [ ] **Step 3: Verify production builds still pass every build test**

Run: `npm run build && npm test`
Expected: all green. `npm run build` prints both `✓ ... free of the clipboard mock` and `✓ chrome/dist/background.js is free of Turndown`; the `no-turndown`, `no-polyfill`, and `no-clipboard-mock` build tests (which shell out to `node scripts/build.js`) all pass against the refactored builder.

- [ ] **Step 4: Verify the watch path still starts (smoke)**

Run: `node scripts/build.js chrome --watch` then Ctrl-C after it prints `[build] watching chrome ...`.
Expected: it builds once, copies assets, prints the watch line, and waits.

- [ ] **Step 5: Full gate**

Run: `npm run typecheck && npm run lint`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/build-extension.js scripts/build.js
git commit -m "build: factor reusable buildExtension out of build.js"
```

---

## Task 6: Direct-compile `build-test-extension.js`

Rewrite the e2e build to compile each test dir DIRECTLY with `profile: 'e2e'` (mock + E2E hooks present) and derive the manifest from the tracked source platform manifest — no copy of the mock-free production output. Drop the redundant `npm run build &&` prefix.

**Files:**
- Modify: `scripts/build-test-extension.js` (replace whole file)
- Modify: `package.json` (`test:e2e:build` script)

- [ ] **Step 1: Rewrite `scripts/build-test-extension.js`**

Overwrite the file:

```js
#!/usr/bin/env node

/**
 * Build the e2e test extensions (chrome-test, chrome-optional-test, firefox-test).
 *
 * Each variant is compiled DIRECTLY with BUILD_PROFILE='e2e' (so the clipboard mock + E2E
 * hooks are present) and gets a manifest derived from the tracked source platform manifest
 * with permissions rewritten for testing. Nothing is copied from the production chrome/ or
 * firefox-mv3/ output (which is mock-free).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './lib/build-extension.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const builds = [
  {
    platform: 'chrome',
    variants: [
      {
        name: 'Chrome default (permissions pre-granted)',
        targetDir: 'chrome-test',
        keepOptionalPermissions: false,
        hostPermissions: ['http://localhost:5566/*'],
      },
      {
        name: 'Chrome optional permissions (request flows)',
        targetDir: 'chrome-optional-test',
        keepOptionalPermissions: true,
        hostPermissions: ['http://localhost:5566/*'],
      },
    ],
  },
  {
    platform: 'firefox-mv3',
    variants: [
      {
        name: 'Firefox default (permissions pre-granted)',
        targetDir: 'firefox-test',
        keepOptionalPermissions: false,
      },
    ],
  },
];

console.log('Building test extensions...');

for (const buildConfig of builds) {
  for (const variant of buildConfig.variants) {
    await buildTestExtensionVariant(buildConfig.platform, variant);
  }
}

/**
 * @param {'chrome'|'firefox-mv3'} platform
 * @param {{ name: string; targetDir: string; keepOptionalPermissions: boolean; hostPermissions?: string[] }} config
 */
async function buildTestExtensionVariant(platform, config) {
  const variantTargetDir = path.join(rootDir, config.targetDir);
  console.log(`\n→ ${config.name}`);

  // Clean the whole variant dir, then compile directly into it with the e2e profile.
  if (fs.existsSync(variantTargetDir)) {
    fs.rmSync(variantTargetDir, { recursive: true });
  }

  console.log(`  Compiling ${platform} → ${config.targetDir}/dist (profile: e2e)`);
  await buildExtension({
    target: platform,
    outdir: path.join(variantTargetDir, 'dist'),
    profile: 'e2e',
  });

  // Derive the variant manifest from the tracked source platform manifest.
  const sourceManifestPath = path.join(rootDir, platform, 'manifest.json');
  const targetManifestPath = path.join(variantTargetDir, 'manifest.json');
  rewriteManifest(sourceManifestPath, targetManifestPath, {
    keepOptionalPermissions: config.keepOptionalPermissions,
    hostPermissions: config.hostPermissions ?? [],
  });

  console.log(`  ✓ Built ${config.targetDir}`);
}

function rewriteManifest(sourceManifestPath, targetManifestPath, options) {
  console.log('  Writing manifest.json');
  const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));

  if (!Array.isArray(manifest.permissions)) {
    manifest.permissions = [];
  }
  if (!Array.isArray(manifest.optional_permissions)) {
    manifest.optional_permissions = [];
  }

  function moveToRequiredPermission(permission) {
    if (manifest.optional_permissions && manifest.optional_permissions.includes(permission)) {
      manifest.optional_permissions = manifest.optional_permissions.filter(p => p !== permission);

      if (!manifest.permissions.includes(permission)) {
        manifest.permissions.push(permission);
      }

      console.log(`    - Moved "${permission}" to permissions`);
    }
  }

  function addRequiredPermission(permission) {
    if (!manifest.permissions.includes(permission)) {
      manifest.permissions.push(permission);
      console.log(`    - Added "${permission}" to permissions`);
    }

    if (manifest.optional_permissions.includes(permission)) {
      manifest.optional_permissions = manifest.optional_permissions.filter(p => p !== permission);
    }
  }

  if (!options.keepOptionalPermissions) {
    moveToRequiredPermission('tabs');
    moveToRequiredPermission('tabGroups');
  } else {
    console.log('    - Keeping tabs/tabGroups optional for permission flow tests');
  }

  addRequiredPermission('bookmarks');

  if (options.hostPermissions.length > 0) {
    if (!manifest.host_permissions) {
      manifest.host_permissions = [];
    }
    for (const hostPermission of options.hostPermissions) {
      if (!manifest.host_permissions.includes(hostPermission)) {
        manifest.host_permissions.push(hostPermission);
        console.log(`    - Added host_permissions for ${hostPermission}`);
      }
    }
  }

  fs.writeFileSync(targetManifestPath, JSON.stringify(manifest, null, 2));

  console.log('    Required:', manifest.permissions.join(', '));
  console.log('    Optional:', manifest.optional_permissions?.join(', ') || 'None');
}
```

- [ ] **Step 2: Drop the `npm run build &&` prefix**

In `package.json`, change:

```json
    "test:e2e:build": "npm run build && node scripts/build-test-extension.js",
```

to:

```json
    "test:e2e:build": "node scripts/build-test-extension.js",
```

- [ ] **Step 3: Build the test extensions**

Run: `npm run test:e2e:build`
Expected: builds `chrome-test`, `chrome-optional-test`, `firefox-test`, each printing `Compiling … (profile: e2e)`, the manifest rewrite lines, and `✓ Built …`.

- [ ] **Step 4: Verify the mock IS present in the e2e build**

Run: `grep -l createMockClipboardService chrome-test/dist/background.js firefox-test/dist/background.js`
Expected: both files listed — the mock factory is bundled in the e2e build.

- [ ] **Step 5: Verify the test manifest got the test permissions**

Run: `node -e "const m=require('./chrome-test/manifest.json'); console.log('perms', m.permissions); console.log('host', m.host_permissions)"`
Expected: `permissions` includes `tabs`, `tabGroups`, `bookmarks`; `host_permissions` includes `http://localhost:5566/*`.

- [ ] **Step 6: Verify production output is still mock-free and intact**

Run: `npm run build`
Expected: both `✓ <target>/dist is free of the clipboard mock` lines print (production is unaffected by the e2e build).

- [ ] **Step 7: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-test-extension.js package.json
git commit -m "build: compile e2e test extensions directly with BUILD_PROFILE=e2e"
```

---

## Task 7: E2E acceptance (Chrome) + PR note

Confirm the e2e hooks still work end-to-end in the directly-compiled test build, then write the PR note. This is verification — no source changes (the PR note is delivered in the final summary / PR body).

**Files:** none (verification + PR note)

- [ ] **Step 1: Run the Chrome e2e suite in Docker**

Run: `npm run test:e2e:docker`
Expected: the suite passes. Read results from `test-results/results.json` (per repo convention), NOT stdout.

- [ ] **Step 2: Handle the known clipboard flake**

If the known-flaky parallel-clipboard test trips, re-run it in isolation (see DEVELOPMENT.md → E2E tests / the run-e2e-in-docker memory) and confirm it passes alone.

- [ ] **Step 3: Confirm the full acceptance gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green; production guard prints mock-free for both targets.

- [ ] **Step 4: Write the PR note**

Draft a short note summarizing the new build shape for the PR body:
- New orthogonal `BUILD_PROFILE` (`'production' | 'e2e'`) define; `BUILD_TARGET` unchanged.
- Mock gated on `BUILD_PROFILE === 'e2e'`; DCE-stripped from production (chrome/firefox dist).
- `buildExtension` factored into `scripts/lib/build-extension.js`; `build-test-extension.js` now compiles each test dir directly with `profile: 'e2e'` (no prod copy); `test:e2e:build` no longer prefixed with `npm run build`.
- New guard: `scripts/assert-no-clipboard-mock.js <target>` (wired into `build-chrome`/`build-firefox-mv3`) + `test/build/no-clipboard-mock-in-production.test.ts`.

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to choose merge/PR and include the PR note.

---

## Self-Review

**Spec coverage:**
- `BUILD_PROFILE` define (ambient/esbuild/vitest) → Task 1. ✓
- DCE gating in clipboard-service.ts → Task 2. ✓
- DCE gating in background.ts → Task 3. ✓
- DCE gating in popup.ts → Task 4. ✓
- `createMockClipboardService`/`MockClipboardService` stay exported → Task 2 Step 4 note. ✓
- `messages.ts` left unchanged (type-only) → not touched (correct; out of scope). ✓
- Factor `buildExtension` + thin `build.js` → Task 5. ✓
- Direct-compile `build-test-extension.js` + manifest-from-source + drop prefix → Task 6. ✓
- `assert-no-clipboard-mock.js` (parameterized) + wire into both builds → Task 2. ✓
- `no-clipboard-mock-in-production.test.ts` → Task 2. ✓
- Per-project vitest define → Task 1 (+ guarded by build-profile-define.test.ts). ✓
- E2E hooks preserved + full gate + Chrome e2e → Task 7. ✓
- PR note → Task 7. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type/name consistency:** `buildExtension({ target, outdir, profile, watch })` signature is identical in its definition (Task 5), the `build.js` wrapper (Task 5), and `build-test-extension.js` (Task 6). Sentinel list `['mockClipboardCalls','__mockClipboardService','createMockClipboardService']` is identical in the script (Task 2 Step 1) and the build test (Task 2 Step 2). `BUILD_PROFILE` literal values `'production'`/`'e2e'` consistent throughout. ✓
