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
//  - browser-polyfill.js (Chrome only — the verbatim file loaded via the external
//    `/vendor/browser-polyfill.js` import in ensure-browser-global.ts)
//  - bulma.css (loaded via <link>)
// The two physical assets are copied straight from node_modules (no src/vendor
// snapshot). turndown/gfm/mustache are bundled by esbuild from node_modules too.
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
  // Physical assets referenced verbatim (bulma via an HTML <link>; the polyfill via the
  // external ESM import in ensure-browser-global.ts), copied straight from node_modules —
  // no src/vendor snapshot, no postinstall step.
  const nodeModules = path.join(root, 'node_modules');
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
  for (const { src, dest } of assets) {
    fs.copyFileSync(src, path.join(vendorDest, dest));
  }
}

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
  plugins: [polyfillResolverPlugin],
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
  console.log(`[build] watching ${target} ...`);
} else {
  await esbuild.build(buildOptions);
  copyAssets(target);
  restoreKeep();
  console.log(`[build] built ${target}`);
}
