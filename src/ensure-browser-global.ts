// Chrome <148 loads the verbatim polyfill as an external side-effect module;
// ESM scope makes its UMD wrapper install `globalThis.browser`. Newer Chrome
// keeps its native global, while Firefox redirects this import to an empty module.
// The root-absolute specifier works from entries at different depths because
// esbuild does not rewrite external paths. Every `browser` entry imports this
// before its module graph evaluates. The import, copied asset, and entry imports
// can be removed once `minimum_chrome_version` reaches 148.
import '/dist/vendor/browser-polyfill.js';
