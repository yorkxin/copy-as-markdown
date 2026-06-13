// Define the `browser.*` global for the Chrome service worker.
//
// Why this exists: the MV3 service worker (background.ts) is a bare ES module with
// no HTML, so unlike the UI pages — which load <script src="vendor/browser-polyfill.js">
// before their module — it has no classic script to install `browser`. The polyfill's
// own global assignment only runs when it is evaluated as a script/ESM; esbuild
// resolves the npm package as CommonJS (its package.json has no "type": "module"),
// wraps it in a CJS shim, and the UMD then takes its `exports`-defined branch and
// never touches the global. So we assign it explicitly here.
//
// `??=` makes this a no-op when `browser` already exists: Firefox's native API, and
// Chrome 148+ which ships `browser.*` natively. Delete this module (and its import in
// background.ts, the HTML <script> tags, and the build.js asset copy) once
// minimum_chrome_version >= 148.
//
// MUST be background.ts's first import so `browser` is defined before any module in
// its graph evaluates.
import browserPolyfill from 'webextension-polyfill';

(globalThis as any).browser ??= browserPolyfill;
