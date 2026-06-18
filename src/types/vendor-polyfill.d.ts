// The Chrome build loads webextension-polyfill verbatim from its shipped location via
// a side-effect import (see src/ensure-browser-global.ts). It has no exports —
// importing it only runs the file to install `globalThis.browser`. This ambient
// declaration lets `tsc` accept the extension-root-absolute specifier.
declare module '/vendor/browser-polyfill.js';
