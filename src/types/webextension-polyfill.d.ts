// The `webextension-polyfill` package ships no TypeScript types. Its default
// export is the `browser` API object — same shape as the global `browser`
// declared by @types/firefox-webext-browser.
declare module 'webextension-polyfill' {
  const browserPolyfill: typeof browser;
  export default browserPolyfill;
}
