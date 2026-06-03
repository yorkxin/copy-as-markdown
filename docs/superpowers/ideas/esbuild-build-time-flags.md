# Idea: adopt esbuild for compile-time build flags (Go-build-tag style)

**Status:** Parked idea — NOT to be done in the `259-turndown-offscreen-conversion` branch.
**Date:** 2026-06-03
**Author context:** Came out of the #259 work (moving Turndown execution off page contexts). While solving "keep Turndown out of the Chrome MV3 service worker," we noted the safety property is currently enforced by a *runtime* flag + a dynamic `import()` + an import-graph lint check. A bundler with build flags would instead enforce it at *compile time* by physically excluding the module — the JS equivalent of Go build tags.

---

## Problem this would solve

The project currently has **no bundler**. `tsc` compiles `src/` once into `dist/`, and `scripts/compile.js <target>` copies that *same* `dist/` into both `chrome/dist` and `firefox-mv3/dist`. Consequences:

- **Chrome and Firefox ship byte-identical JS.** They differ only at *runtime*, via `firefox-mv3/hacks.js` injecting globals (`ALWAYS_USE_NAVIGATOR_COPY_API`, `PERIDOCIALLY_REFRESH_MENU`, and — after #259 — `CONVERT_MARKDOWN_IN_BACKGROUND`) that `src/config/flags.ts` reads.
- **There is no way to exclude a module from one target.** Every module reachable from an entry point is shipped to both browsers. The Chrome MV3 service worker has no DOM, yet any DOM-only dependency (e.g. Turndown) that ends up in its static import graph would load — and crash the background script — even though Chrome never needs it.
- Today the only guardrails against that are (a) careful use of a dynamic `import()` and (b) an import-graph check script. Both are *detection*, not *exclusion*.

Go solves the analogous problem with build tags (`//go:build chrome`): a file/branch is simply not compiled for a target. TypeScript's `tsc` has **no equivalent** — no conditional compilation, no per-target file exclusion. A bundler provides it.

## What "build flags" look like with a bundler

The goal: a target is known at build time, and code/imports gated on that target are physically dropped from the other target's output.

### Option A — `define` + dead-code elimination (the build-flag analog)

```js
// build.js  — run once per target (chrome | firefox)
import * as esbuild from 'esbuild';
const target = process.argv[2]; // 'chrome' | 'firefox'

await esbuild.build({
  entryPoints: [
    'src/background.ts',
    'src/offscreen.ts',
    'src/ui/popup.ts',
    'src/ui/options.ts',
    'src/ui/options-permissions.ts',
    'src/ui/permissions.ts',
    'src/ui/custom-format.ts',
    'src/ui/check-custom-formats.ts',
    // …every HTML entry's script
  ],
  bundle: true,
  format: 'esm',
  splitting: false,        // MV3 service workers do not support code-splitting chunks
  outdir: `${target}/dist`,
  define: { BUILD_TARGET: JSON.stringify(target) },
  // sourcemap, minify, etc. as desired
});
```

```ts
// usage in code
declare const BUILD_TARGET: 'chrome' | 'firefox';

if (BUILD_TARGET === 'firefox') {
  const { htmlToMarkdown } = await import('./lib/html-to-markdown.js');
  // …
}
```

On the **Chrome** build, esbuild constant-folds `BUILD_TARGET === 'firefox'` → `false`, removes the branch, and with it the only reference to `html-to-markdown` → **Turndown is never bundled into the Chrome output.** On **Firefox** it is included. Exactly the build-tag behavior.

### Option B — module aliasing / stubbing (the literal "module X only exists when flag set")

```js
alias: target === 'chrome'
  ? { './lib/html-to-markdown': './src/lib/html-to-markdown.stub.ts' }
  : {},
```

On Chrome, even a *static* import of `./lib/html-to-markdown` resolves to a no-op stub — it becomes structurally impossible to pull Turndown into the Chrome bundle. This is the closest analog to webpack's `NormalModuleReplacementPlugin`.

### Option C — per-target entry files

`background.chrome.ts` and `background.firefox.ts` that import only what each needs; the bundler naturally excludes the rest. Most explicit (mirrors Go's file-per-tag), at the cost of some duplication.

## Tool comparison

| Tool | Build-flag mechanism | Notes |
|---|---|---|
| **esbuild** (recommended) | `define` + DCE; `alias` for stubbing | Tiny, fast, single dep. Easiest fit for an extension. No native HTML-entry handling — list each script entry point explicitly. |
| **Rollup** | `@rollup/plugin-replace` + tree-shaking; `@rollup/plugin-alias` | Best-in-class tree-shaking. More plugins/config. |
| **Vite** | `define` / `import.meta.env`; built on Rollup+esbuild | `@crxjs/vite-plugin` gives MV3 HMR and manifest handling. Heaviest but most "batteries included". |
| **webpack** | `DefinePlugin` + `NormalModuleReplacementPlugin` + `IgnorePlugin` | Most literal module-replacement story; heaviest to adopt. |

## Upside if adopted

- **Real compile-time exclusion.** DOM-only modules (Turndown) physically absent from the Chrome service-worker bundle — not just "not statically reachable by convention."
- **Retire `hacks.js` and the target-differentiating runtime flags.** `ALWAYS_USE_NAVIGATOR_COPY_API` and `CONVERT_MARKDOWN_IN_BACKGROUND` exist only to tell otherwise-identical builds which target they're running on. With `BUILD_TARGET` baked in at compile time, those globals and the `firefox-mv3/hacks.js` injection can largely go away. (Flags that are genuinely runtime toggles — e.g. mock-clipboard mode — stay.)
- **Drop the import-graph safety check** added/considered for #259 — the bundler enforces the invariant structurally, so the custom `scripts/check-service-worker-imports.js` becomes unnecessary.
- Smaller, faster output; tree-shaking; real source maps.

## Cost / risks

- **Bigger change than any single feature.** Every HTML page's script becomes a bundler entry point; the vendored `.mjs` files (`src/vendor/*`), `web_accessible_resources` paths, and the `src/static` copy step all need to be re-expressed in the bundler config.
- **MV3 service-worker constraints:** no code-splitting/dynamic-chunk loading for the SW entry; keep `splitting: false` and a single output file per entry.
- **`scripts/compile.js` / `scripts/debug.js` / e2e build (`scripts/build-test-extension.js`) and the `package.json` scripts** all need reworking around the new build.
- Source maps, watch mode (`nodemon` today), and the Playwright e2e build need re-validation.

## Suggested migration sketch (when picked up)

1. Add `esbuild` as a devDependency; write `scripts/build.js <target>` (Option A above) covering all entry points.
2. Introduce `BUILD_TARGET` define; add an ambient `declare const BUILD_TARGET` (e.g. in a `.d.ts`).
3. Port one entry (`background.ts`) first; diff the output against the current `tsc`+copy output to confirm parity.
4. Migrate remaining entries; wire `src/vendor` and `src/static` copying (esbuild `loader`/`copy` plugin or a post-step).
5. Replace `compile-chrome` / `compile-firefox-mv3` scripts with `node scripts/build.js chrome|firefox`.
6. Convert the converter selection from the runtime `CONVERT_MARKDOWN_IN_BACKGROUND` flag to `if (BUILD_TARGET === 'firefox')` with a gated dynamic import (or Option B alias).
7. Once target differentiation is fully compile-time, remove `firefox-mv3/hacks.js` target globals and the corresponding `Flags.*` accessors; delete the import-graph check script.
8. Re-validate unit + browser tests and the Playwright e2e against the new builds.

## Relationship to #259

#259 ships **without** this (runtime flag + dynamic import + optional import-graph check). This idea is the cleaner long-term replacement for the target-differentiation machinery. If/when adopted, revisit:

- `src/config/flags.ts` (drop target flags)
- `firefox-mv3/hacks.js` (likely delete)
- `src/services/markdown-converter.ts` (flag → `BUILD_TARGET` branch)
- any `scripts/check-service-worker-imports.js` guard (delete — superseded)
