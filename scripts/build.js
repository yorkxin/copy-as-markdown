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

  const onAssetChange = () => {
    try {
      copyAssets(target);
      restoreKeep();
    } catch (err) {
      console.error('[build] asset re-copy failed:', err);
    }
  };
  const watchAssets = (dir) => {
    try {
      fs.watch(dir, { recursive: true }, onAssetChange);
    } catch (err) {
      console.warn(`[build] could not watch ${dir} for asset changes (${err.code ?? err.message}); `
        + 'static/vendor live-recopy disabled — JS rebuilds still work.');
    }
  };
  watchAssets(path.join(srcDir, 'static'));
  watchAssets(path.join(srcDir, 'vendor'));
  console.log(`[build] watching ${target} ...`);
} else {
  await esbuild.build(buildOptions);
  copyAssets(target);
  restoreKeep();
  console.log(`[build] built ${target}`);
}
