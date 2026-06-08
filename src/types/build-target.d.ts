/**
 * Injected by esbuild's `define` at build time (see scripts/build.js).
 * `'chrome'` for the Chrome MV3 build, `'firefox-mv3'` for the Firefox build.
 * Branches gated on this constant are dead-code-eliminated for the other target.
 */
declare const BUILD_TARGET: 'chrome' | 'firefox-mv3';
