// Empty module. Firefox implements browser.* natively and ships no polyfill, so the
// `/vendor/browser-polyfill.js` side-effect import (Chrome only) is redirected here
// for the Firefox build (see the onResolve plugin in scripts/build.js).
export {};
