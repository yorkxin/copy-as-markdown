# Design: ship `browser-polyfill.js` to Chrome only (drop it from Firefox)

**Date:** 2026-06-14
**Branch:** `firefox-drop-browser-polyfill` (off `master`)
**Idea note:** `idea/firefox-drop-browser-polyfill` branch holds the original parked note; its
"Update 2026-06-14" baseline is the source of this design.

## Goal

Make `webextension-polyfill` (`browser-polyfill.js`) ship to the **Chrome** build only and be fully
absent from the **Firefox** build. Firefox implements `browser.*` natively, so the polyfill is
redundant there (~25 KB of dead weight + an extra parse/network step per page). This changes what
loads on Firefox, so it is a Firefox behavior change that must be verified by hand.

## Precondition (confirmed on `master`)

- esbuild migration present: `scripts/build.js`, the `BUILD_TARGET` `define`, per-target asset copy.
- `retire-vendor-postinstall` landed (commit `c274931`, #267): `src/ensure-browser-global.ts` exists
  and is imported **only** by `src/background.ts` (its first import); no polyfill import in
  `settings.ts`; UI bundles are already polyfill-free (UI pages get `browser` solely from the classic
  `<script src="../vendor/browser-polyfill.js">`).

So today the polyfill reaches the extension two independent ways, and both must be addressed for
Firefox:

1. **Copied asset** `vendor/browser-polyfill.js`, referenced by a classic `<script>` in every
   `src/static/*.html`, copied to `<target>/dist/vendor/` by the `assets` loop in `copyAssets()`.
2. **Bundled import** in `src/ensure-browser-global.ts` (`import browserPolyfill from
   'webextension-polyfill'; (globalThis as any).browser ??= browserPolyfill;`), inlined into
   `<target>/dist/background.js` by esbuild.

## Three coordinated changes

### 1. Asset copy — `scripts/build.js`, `copyAssets()`

Gate the `browser-polyfill.js` asset on `t === 'chrome'` (analogous to the existing `offscreen.html`
exclusion). `bulma.css` continues to copy for both targets. Result: no
`firefox-mv3/dist/vendor/browser-polyfill.js`; Chrome's `vendor/` is unchanged.

### 2. Service-worker bundled import — `src/ensure-browser-global.ts`

Gate the assignment on `BUILD_TARGET === 'chrome'`:

```ts
import browserPolyfill from 'webextension-polyfill';

if (BUILD_TARGET === 'chrome') {
  (globalThis as any).browser ??= browserPolyfill;
}
```

- Chrome: `define` makes the condition always true → behavior identical to today.
- Firefox: `define` makes it always false → esbuild dead-code-eliminates the `??=` block, and the
  `browserPolyfill` binding becomes unused.

**Then verify** the polyfill is actually gone from `firefox-mv3/dist/background.js` with a marker grep
(see Verification). `webextension-polyfill` is CommonJS and does **not** declare
`"sideEffects": false`, so esbuild may retain the now-unused `import` even after DCE.

**Fallback (only if the marker survives):** add a **Firefox-only esbuild `alias`** mapping
`webextension-polyfill` → a tiny empty stub module, so the retained import resolves to nothing and
zero polyfill bytes ship. The gated `??=` already guarantees Firefox never reads the (now empty)
default at runtime, and Firefox's native `browser` is left intact by `??=`.

**Why not a dynamic import.** A `BUILD_TARGET`-gated `await import()` would drop the dependency
cleanly in general, but `background.ts` is an MV3 service worker: top-level `await` makes the module
async and breaks **synchronous** event-listener registration (Chrome drops events on worker wake),
and a non-awaited dynamic import would resolve after top-level `browser.*` calls. `ensure-browser-global`
must stay Chrome's synchronous first import. The alias fallback removes the bytes with no sequencing
change, so it is preferred over a dynamic import.

### 3. UI classic `<script>` — HTML post-processing in `copyAssets()` (approach 3a)

After the `cpSync` of `src/static` into `<target>/dist/static`, for **Firefox only**, rewrite each
copied `*.html` to strip the line referencing `vendor/browser-polyfill.js` (whitespace-tolerant
match; the tag appears with varying indentation across the 8 pages). Chrome's copied HTML is left
untouched.

This covers all pages that carry the tag, including the entry-less `about.html`, `single-link.html`,
and `custom-format-help.html` (which have no JS bundle to inject into — the reason approach 3b was
rejected). It must also run on the **watch-mode** asset re-copy path (`onAssetChange`), not just the
one-shot build, so live-reload Firefox builds don't 404.

**Rejected alternative (3b):** move the UI polyfill into each page bundle (gated chrome) and drop the
tag + asset entirely. Rejected because it inlines ~25 KB into every Chrome UI bundle (no shared
cache — a Chrome behavior change the constraints forbid), leaves the entry-less pages with nowhere to
inject `browser`, and needs per-page load-order verification.

## Constraints / non-goals (untouched)

- **Chrome build unchanged** — same asset, same `<script>` tags, same `background.js`. Verified by
  diffing the Chrome `dist`.
- **Turndown / `BUILD_TARGET` converter exclusion** — not touched.
- **License attribution intact** — `about.html`'s attribution text (the `webextension-polyfill`
  section) stays for both targets; the polyfill is still listed there. The Chrome-shipped
  `browser-polyfill.js` keeps its file header (we still copy it verbatim for Chrome). Only the
  `<script>` *load* is removed on Firefox, not the attribution.
- **No normalization dependency** — Firefox's native `browser` is the reference implementation the
  polyfill emulates, so nothing on Firefox relies on polyfill-specific behavior. Confirmed
  conceptually; verified by the manual smoke test.

## Verification / acceptance

- `firefox-mv3/dist/vendor/browser-polyfill.js` does not exist.
- No Firefox-built `*.html` still references `vendor/browser-polyfill.js` (grep → 0).
- Polyfill code absent from Firefox JS bundles: marker grep over `firefox-mv3/dist/**` → 0. Marker:
  `wrapAPIs` (a function name internal to `webextension-polyfill`, unique to the polyfill source).
- Chrome `dist` byte-identical to a pre-change build (asset, HTML, and `background.js` unchanged).
- `npm run typecheck`, `npm run lint`, `npm test` green.
- Chrome e2e green (runs in Docker per project convention).
- **Firefox build manually smoke-tested**: popup copy, options page, permissions flow,
  selection→Markdown. (The e2e suite is Chrome-only.)
- Short PR note describing the change.

## Commit plan (frequent commits)

1. Change 1 (asset gate) + Firefox build + confirm asset absent.
2. Change 2 (assignment gate) + Firefox build + marker grep; add alias fallback in the same step
   only if the grep is non-zero.
3. Change 3 (HTML strip, incl. watch path) + Firefox build + HTML grep.
4. Run typecheck/lint/test + Chrome e2e; Chrome `dist` diff check.
5. Manual Firefox smoke test; PR note.
