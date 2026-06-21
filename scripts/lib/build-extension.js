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
    minifySyntax: profile === 'production', // DCE for production: eliminates BUILD_PROFILE dead branches
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
