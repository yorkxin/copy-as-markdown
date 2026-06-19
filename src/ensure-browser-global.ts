// Install the `browser.*` global for old Chrome (< 148).
//
// This is a side-effect import of the *verbatim* polyfill file shipped at
// `dist/vendor/browser-polyfill.js` (Chrome only). Loaded as its own ES module, the
// polyfill's UMD wrapper takes its global-assignment branch (ESM scope has no
// CommonJS `exports`) and self-installs `globalThis.browser`. On modern Chrome the
// polyfill is a no-op (it returns the existing native `browser`). On Firefox the build
// redirects this import to an empty module (see scripts/build.js), so the polyfill is
// never loaded — Firefox uses its native `browser`.
//
// The specifier is extension-root-absolute. The extension root is the directory holding
// manifest.json; all built files live under `dist/` (e.g. the SW is at
// `chrome-extension://<id>/dist/background.js`), so the polyfill is at
// `/dist/vendor/browser-polyfill.js`. A root-absolute path resolves identically from
// entries at any depth (`dist/background.js` vs `dist/ui/*.js`); esbuild does not
// rewrite external import paths, so a depth-independent specifier is required.
//
// esbuild keeps this import external for Chrome (one shared, cached file — never
// inlined into each bundle).
//
// Every entry that uses `browser` imports this module FIRST so the global exists
// before any module in the graph evaluates — the service worker (background.ts) and
// each UI entry. Delete this file, the asset copy, and those imports once
// minimum_chrome_version >= 148.
import '/dist/vendor/browser-polyfill.js';
